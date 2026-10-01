"use client";
import {
  AlertCircle,
  Check,
  CircleHelp,
  FileSearch,
  LoaderCircle,
  X,
  Sparkles,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./button";
import { label } from "@/lib/utils";
export function Badge({ status, children }: { status?: string; children?: React.ReactNode }) {
  const good = ["SATISFIED", "Processed", "Ready", "Completed"].includes(status || "");
  const bad = ["NOT_SATISFIED", "Failed", "Critical"].includes(status || "");
  return (
    <span className={`badge ${good ? "badge-green" : bad ? "badge-red" : "badge-amber"}`}>
      {good ? <Check size={12} /> : bad ? <AlertCircle size={12} /> : <CircleHelp size={12} />}{" "}
      {children || label(status || "")}
    </span>
  );
}
export function Loading({ text = "Loading your workspace…" }: { text?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{text}</p>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error | null; retry?: () => void }) {
  return (
    <div className="state" role="alert">
      <AlertCircle size={30} />
      <h3>We couldn’t load this</h3>
      <p>{error?.message || "Please try again."}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="state">
      <FileSearch size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Disclaimer() {
  return (
    <p className="disclaimer">
      <Sparkles size={14} /> Fit Score measures alignment with published requirements. It is not an
      admission probability.
    </p>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content className="modal">
          <div className="modal-head">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog">
                <X size={20} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="muted">
            {description || "Review the details below."}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
