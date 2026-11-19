"use client";
import { useActionState, useState } from "react";
import { createReferral } from "../../actions";
import { ErrorSummary, InlineError, fieldProps } from "@/components/FormErrors";
import { formValues, validateReferral, type FieldError } from "@/lib/validation";

const GROUPS = ["Medical Oncology", "Radiation Oncology", "Hematology", "Surgical Oncology", "Gynecologic Oncology"];

export function ReferralForm() {
  const [state, action, pending] = useActionState(createReferral, null);
  const [clientErrors, setClientErrors] = useState<FieldError[] | null>(null);
  const errors = clientErrors ?? state?.errors ?? [];
  const field = (id: string, label: string, type = "text") => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      <input id={id} name={id} type={type} {...fieldProps(errors, id)} className="mt-1 w-full rounded-md border border-slate-400 px-3 py-2" />
      <InlineError errors={errors} id={id} />
    </div>
  );
  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        const errs = validateReferral(formValues(e.currentTarget));
        setClientErrors(errs.length ? errs : null);
        if (errs.length) e.preventDefault();
      }}
      className="grid max-w-3xl gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
      <ErrorSummary errors={errors} className="sm:col-span-2" />
      {field("firstName", "First name")}
      {field("lastName", "Last name")}
      {field("dob", "Date of birth", "date")}
      {field("phone", "Phone", "tel")}
      {field("email", "Email", "email")}
      {field("appointmentAt", "First appointment (date and time)", "datetime-local")}
      <div>
        <label htmlFor="providerGroup" className="block text-sm font-medium text-slate-700">Provider group</label>
        <select id="providerGroup" name="providerGroup" {...fieldProps(errors, "providerGroup")} className="mt-1 w-full rounded-md border border-slate-400 px-3 py-2">
          <option value="">Select…</option>
          {GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <InlineError errors={errors} id="providerGroup" />
      </div>
      <div className="sm:col-span-2">
        <p className="text-sm text-slate-600">On save, the intake email is scheduled for 7 days before the appointment (or sent right away if the appointment is sooner).</p>
        <button disabled={pending} className="mt-3 rounded-md bg-ia-600 px-5 py-2 font-semibold text-white hover:bg-ia-700">Save referral</button>
      </div>
    </form>
  );
}
