"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { format, formatPrice } from "@/i18n/dictionaries";
import { useCart, useCustomer, type CustomerDraft } from "@/lib/cart-store";
import type { BranchInfo, MenuItem, StopList } from "@/lib/menu-types";
import { normalizePhone, type OrderInput } from "@/lib/order-schema";
import { getTelegram, haptic, useBackButton, useIsTelegram, useMainButton } from "@/lib/telegram";
import { useBranch, useDetectLocation } from "@/lib/use-branch";
import { useCartSummary } from "@/lib/use-cart-summary";
import { BranchPicker, PinIcon } from "./BranchPicker";
import { ItemImage } from "./ItemImage";
import { useI18n } from "./Providers";
import { QtyControl } from "./QtyControl";

type Props = { items: MenuItem[]; branches: BranchInfo[]; stopList: StopList; phone: string | null };
type Errors = Partial<Record<"name" | "phone" | "address" | "form", string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done"; orderNo: string };

export function Checkout({ items, branches, stopList, phone: restaurantPhone }: Props) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const isTelegram = useIsTelegram();
  const { branch, unavailable, select } = useBranch(branches, stopList);
  const { rows, orderable, total, count, ready } = useCartSummary(items, unavailable);
  const { location, status: locationStatus, detect } = useDetectLocation(branches);
  const clearCart = useCart((s) => s.clear);
  const dropLine = useCart((s) => s.drop);
  const customer = useCustomer();
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const menuHref = `/${locale}`;
  const done = status.kind === "done";

  // Prefill the name from the Telegram profile on first visit.
  useEffect(() => {
    const user = getTelegram()?.initDataUnsafe.user;
    if (user && !useCustomer.getState().name) {
      useCustomer.getState().update({ name: [user.first_name, user.last_name].filter(Boolean).join(" ") });
    }
  }, []);

  useBackButton(done ? null : () => router.push(menuHref));

  function edit(patch: Partial<CustomerDraft>, field: keyof Errors) {
    customer.update(patch);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function requestPhoneFromTelegram() {
    getTelegram()?.requestContact((shared, res) => {
      const phone = res?.responseUnsafe?.contact?.phone_number;
      if (shared && phone) edit({ phone: phone.startsWith("+") ? phone : `+${phone}` }, "phone");
    });
  }

  async function shareLocation() {
    // Passive: suggests the nearest branch only if the customer hasn't chosen one by hand.
    if (await detect({ pickNearest: false })) setErrors((e) => ({ ...e, address: undefined }));
  }

  async function submit() {
    if (status.kind !== "idle" || orderable.length === 0) return;
    const next: Errors = {};
    if (!customer.name.trim()) next.name = dict.errors.required;
    if (!normalizePhone(customer.phone)) next.phone = dict.errors.phone;
    if (customer.deliveryType === "delivery" && !customer.address.trim() && !location) next.address = dict.errors.required;
    setErrors(next);
    if (Object.keys(next).length) {
      haptic("error");
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const body: OrderInput = {
      items: orderable.map((r) => ({ id: r.item.id, qty: r.qty })),
      branchId: branch.id,
      name: customer.name,
      phone: customer.phone,
      deliveryType: customer.deliveryType,
      address: customer.deliveryType === "delivery" ? customer.address : "",
      details: customer.deliveryType === "delivery" ? customer.details : "",
      location: customer.deliveryType === "delivery" ? location : null,
      payment: customer.payment,
      comment,
      locale,
      initData: getTelegram()?.initData ?? "",
      website,
    };

    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "server");
      clearCart();
      haptic("success");
      setStatus({ kind: "done", orderNo: data.orderNo });
      window.scrollTo({ top: 0 });
    } catch (err) {
      const code = err instanceof Error ? err.message : "server";
      const message =
        code === "rate_limit" ? dict.errors.rateLimit : code === "unavailable" ? dict.errors.unavailable : dict.errors.generic;
      setErrors({ form: message });
      setStatus({ kind: "idle" });
      haptic("error");
    }
  }

  const sending = status.kind === "sending";
  useMainButton(
    done ? dict.success.close : orderable.length ? `${dict.checkout.submit} · ${formatPrice(total, dict)}` : null,
    () => (done ? getTelegram()?.close() : submit()),
    { loading: sending },
  );

  if (done) {
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="m5 12 5 5 9-10" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold">{dict.success.title}</h1>
        <p className="mt-2 text-muted">{format(dict.success.text, { no: `#${status.orderNo}` })}</p>
        {!isTelegram && (
          <Link href={menuHref} className="mt-8 rounded-full bg-accent px-6 py-3 font-bold text-accent-fg hover:bg-accent-hover">
            {dict.success.back}
          </Link>
        )}
      </main>
    );
  }

  if (!ready) return null;

  if (rows.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold">{dict.cart.empty}</p>
        <Link href={menuHref} className="mt-6 rounded-full bg-accent px-6 py-3 font-bold text-accent-fg hover:bg-accent-hover">
          {dict.cart.toMenu}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-32">
      <div className="flex items-center gap-3 pt-4 pb-3">
        {!isTelegram && (
          <Link href={menuHref} aria-label={dict.cart.toMenu} className="-ml-2 rounded-full p-2 hover:bg-surface-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 text-2xl font-extrabold">{dict.cart.title}</h1>
        <button type="button" onClick={clearCart} className="text-sm font-semibold text-muted hover:text-danger">
          {dict.cart.clear}
        </button>
      </div>

      <ul className="divide-y divide-line rounded-2xl bg-surface px-3">
        {rows.map(({ item, qty, available }) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <ItemImage
              src={item.image}
              alt={item.name}
              sizes="64px"
              className={`h-14 w-14 shrink-0 rounded-xl ${available ? "" : "opacity-40 grayscale"}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`line-clamp-2 leading-snug font-semibold ${available ? "" : "text-muted line-through"}`}>{item.name}</p>
              {available ? (
                <p className="text-sm text-muted tabular-nums">{formatPrice(item.price * qty, dict)}</p>
              ) : (
                <p className="text-sm text-danger">{format(dict.cart.unavailable, { branch: branch.name })}</p>
              )}
            </div>
            <div className="w-28 shrink-0">
              {available ? (
                <QtyControl id={item.id} qty={qty} addLabel={dict.menu.add} size="sm" />
              ) : (
                <button
                  type="button"
                  onClick={() => dropLine(item.id)}
                  className="h-9 w-full rounded-full bg-surface-2 text-sm font-semibold text-muted hover:text-danger"
                >
                  {dict.cart.remove}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between px-1 pt-3 pb-6">
        <span className="text-muted">
          {dict.cart.total} · {count}
        </span>
        <span className="text-xl font-extrabold tabular-nums">{formatPrice(total, dict)}</span>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Section title={dict.checkout.contacts}>
          <Field label={dict.checkout.name} error={errors.name}>
            <input
              value={customer.name}
              onChange={(e) => edit({ name: e.target.value }, "name")}
              autoComplete="name"
              maxLength={60}
              aria-invalid={!!errors.name}
              className={inputClass(errors.name)}
            />
          </Field>
          <Field label={dict.checkout.phone} error={errors.phone}>
            <input
              type="tel"
              inputMode="tel"
              value={customer.phone}
              onFocus={() => !customer.phone && customer.update({ phone: "+998 " })}
              onChange={(e) => edit({ phone: e.target.value }, "phone")}
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              maxLength={30}
              aria-invalid={!!errors.phone}
              className={inputClass(errors.phone)}
            />
          </Field>
          {isTelegram && (
            <button type="button" onClick={requestPhoneFromTelegram} className="text-sm font-semibold text-accent">
              {dict.checkout.phoneFromTelegram}
            </button>
          )}
        </Section>

        <Section title={dict.checkout.howToGet}>
          <BranchPicker branches={branches} current={branch} onSelect={select} className="w-full justify-start" />
          <Segmented
            value={customer.deliveryType}
            onChange={(deliveryType) => customer.update({ deliveryType })}
            options={[
              { value: "delivery", label: dict.checkout.delivery },
              { value: "pickup", label: dict.checkout.pickup },
            ]}
          />
          {customer.deliveryType === "delivery" ? (
            <>
              <Field label={dict.checkout.address} error={errors.address}>
                <input
                  value={customer.address}
                  onChange={(e) => edit({ address: e.target.value }, "address")}
                  autoComplete="street-address"
                  placeholder={dict.checkout.addressPlaceholder}
                  maxLength={300}
                  aria-invalid={!!errors.address}
                  className={inputClass(errors.address)}
                />
              </Field>
              <Field label={dict.checkout.details}>
                <input
                  value={customer.details}
                  onChange={(e) => customer.update({ details: e.target.value })}
                  maxLength={200}
                  className={inputClass()}
                />
              </Field>
              <button
                type="button"
                onClick={shareLocation}
                disabled={locationStatus === "loading"}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ring-1 transition-colors disabled:opacity-60 ${
                  location ? "bg-success/10 text-success ring-success/30" : "text-accent ring-accent/40 hover:bg-accent-soft"
                }`}
              >
                <PinIcon className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold">
                    {locationStatus === "loading"
                      ? dict.branch.detecting
                      : location
                        ? dict.checkout.locationAdded
                        : dict.checkout.location}
                  </span>
                  {!location && <span className="block text-muted">{dict.checkout.locationHint}</span>}
                </span>
              </button>
              {(locationStatus === "denied" || locationStatus === "unavailable") && (
                <p className="text-sm text-danger">{dict.branch[locationStatus]}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              {format(dict.checkout.pickupFrom, { address: branch.address })}
              <a href={branch.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold text-accent">
                {dict.footer.openMap}
              </a>
            </p>
          )}
        </Section>

        <Section title={dict.checkout.payment}>
          <Segmented
            value={customer.payment}
            onChange={(payment) => customer.update({ payment })}
            options={[
              { value: "cash", label: dict.checkout.cash },
              { value: "card", label: dict.checkout.card },
            ]}
          />
        </Section>

        <Section title={dict.checkout.comment}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={dict.checkout.commentPlaceholder}
            rows={3}
            maxLength={500}
            className={`${inputClass()} h-auto resize-none py-3`}
          />
        </Section>

        {/* Honeypot for bots; hidden from people and screen readers. */}
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          name="website"
        />

        <p className="px-1 text-sm text-muted">{dict.checkout.note}</p>

        {errors.form && (
          <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {errors.form}
            {restaurantPhone && <span className="block font-normal">{format(dict.errors.callUs, { phone: restaurantPhone })}</span>}
          </div>
        )}

        {!isTelegram && (
          <button
            type="submit"
            disabled={sending}
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-accent px-5 font-bold text-accent-fg shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            <span>{sending ? dict.checkout.sending : dict.checkout.submit}</span>
            <span className="tabular-nums">{formatPrice(total, dict)}</span>
          </button>
        )}
      </form>
    </main>
  );
}

function inputClass(error?: string) {
  return `h-12 w-full rounded-xl bg-bg px-4 outline-none ring-1 transition-shadow placeholder:text-muted focus:ring-2 ${
    error ? "ring-danger focus:ring-danger" : "ring-line focus:ring-accent"
  }`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-2xl bg-surface p-4">
      <legend className="float-left mb-1 w-full text-base font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
            value === o.value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
