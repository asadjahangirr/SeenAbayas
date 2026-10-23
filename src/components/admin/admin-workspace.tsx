"use client";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
  type FormEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { permits, sectionAllowed, legacyAccess, type AdminAccess } from "@/lib/admin/permissions";
import { adminNavigation, sectionDescriptions, sectionDestinations, customerCopy } from "@/lib/admin/presentation";
import {
  ArrowUpRight,
  Menu,
  X,
  Plus,
  Upload,
  Check,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  Eye,
  LogOut,
} from "lucide-react";
import {
  adminSections,
  sectionNames,
  type AdminSection,
  type AdminSnapshot,
  type AdminProduct,
  type AdminRecord,
  type RecordKind,
} from "@/lib/admin/model";
import {
  defaultDocument,
  announcementTextFor,
  deliveryThresholdFor,
  siteDocumentSchema,
  type SiteDocument,
} from "@/lib/cms/model";
import {
  collectionPieces,
  photographDescriptions,
  toneByDesign,
} from "@/data/collection";
import developmentCatalog from "@/data/development-catalog.json";
import copyRegistry from "@/data/cms-copy.generated.json";
import { formatGbp } from "@/lib/money";
import { ChangeEmail } from "./change-email";
import { AccountTeam } from "./account-team";
import { ConnectionChecks } from "./connection-checks";
import { ShippingSettingsEditor } from "./shipping-settings";
import { settingsSchema } from "@/lib/policies";
import { productSchema } from "@/lib/admin/model";
import { MoneyInput } from "./money-input";
import { AdminPageHelp } from "./page-help";
import { OrderDetails } from "./order-details";
import { orderCsv, orderDetails } from "@/lib/admin/orders";

import {
  adminRequest,
  uploadAdminFile,
  type LibraryFile,
} from "@/lib/admin/client";
import { AdminMediaProvider, MediaChoiceButton } from "./media-picker";
import {
  MediaSectionsEditor,
  createMediaSection,
} from "./media-sections-editor";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="admin-empty">
      <span className="admin-empty__line" />
      <p>{text}</p>
    </div>
  );
}
function Stats({
  values,
}: {
  values: { label: string; value: string | number; note?: string }[];
}) {
  return (
    <div className="admin-stats">
      {values.map((v) => (
        <div key={v.label}>
          <span>{v.label}</span>
          <strong>{v.value}</strong>
          {v.note && <small>{v.note}</small>}
        </div>
      ))}
    </div>
  );
}
function Status({ children }: { children: ReactNode }) {
  return <span className="admin-status">{children}</span>;
}

export function AdminWorkspace({
  section: initialSection,
  initial,
  email,
  role,
  access: initialAccess,
}: {
  access?: AdminAccess;
  section: AdminSection;
  initial: AdminSnapshot;
  email: string;
  role: "owner" | "editor";
}) {
  const pathname = usePathname();
  const candidate = pathname.split("/")[2] || "dashboard";
  const section: AdminSection = (adminSections as readonly string[]).includes(candidate) ? candidate as AdminSection : initialSection;
  const editVersion = useRef(0);
  const siteDirty = useRef(false);
  const refreshVersion = useRef(0);
  const libraryLoaded = useRef(false);
  const libraryPending = useRef<Promise<void> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "phone">("desktop");
  const [mobile, setMobile] = useState(false);
  const [createProductRequest, setCreateProductRequest] = useState(0);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const access: AdminAccess = snapshot.access?.permissions_ready ? { mainAdmin: snapshot.access.main_admin, permissions: snapshot.access.permissions } : initialAccess || legacyAccess(role);
  const can = (key: string) => permits(access, key);
  const parsed = useMemo(() => siteDocumentSchema.safeParse(initial.site.draft), [initial.site.draft]);
  const [document, setDocument] = useState<SiteDocument>(
    parsed.success ? parsed.data : defaultDocument,
  );
  const policySettings = useMemo(() => settingsSchema.safeParse(document.policies), [document.policies]);
  const currentPolicies = policySettings.success
    ? policySettings.data
    : settingsSchema.parse(defaultDocument.policies);
  const [dirty, setDirty] = useState(false);
  const [productDirty, setProductDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error)
      feedbackRef.current?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [error]);
  const [notice, setNotice] = useState("");
  const [library, setLibrary] = useState<LibraryFile[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    const mq = matchMedia("(max-width: 900px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const previous = window.document.activeElement as HTMLElement;
    const oldOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    sidebar.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
      if (e.key !== "Tab") return;
      const focusable = [
        ...sidebar.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ),
      ];
      const first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && window.document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && window.document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    sidebar.addEventListener("keydown", keydown);
    return () => {
      sidebar.removeEventListener("keydown", keydown);
      window.document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [mobile, open]);
  const contentSections: AdminSection[] = [
    "content",
    "hero",
    "media",
    "appearance",
    "settings",
  ];
  const editSite = (next: SiteDocument) => {
    siteDirty.current = true;
    editVersion.current++;
    setDocument(next);
    setDirty(true);
  };
  const refresh = async () => {
    const version = ++refreshVersion.current;
    const r = await fetch("/api/admin", { cache: "no-store" });
    if (!r.ok) throw new Error("Could not reload the workspace.");
    const s = await r.json();
    if (version === refreshVersion.current) setSnapshot(previous => ({ ...s, connection: s.connection || previous.connection, site: !siteDirty.current && s.site.version >= previous.site.version ? s.site : previous.site }));
    return s as AdminSnapshot;
  };
  useEffect(() => {
    if (!["dashboard", "orders", "inbox"].includes(section) || busy || dirty)
      return;
    let cancelled = false;
    const poll = async () => {
      if (
        window.document.hidden ||
        window.document.querySelector(".admin-record[open]")
      )
        return;
      const response = await fetch("/api/admin", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const next = (await response.json()) as AdminSnapshot;
      if (cancelled) return;
      setSnapshot(previous => ({ ...next, connection: next.connection || previous.connection, site: next.site.version >= previous.site.version ? next.site : previous.site }));
      const draft = siteDocumentSchema.safeParse(next.site.draft);
      setDocument(draft.success ? draft.data : defaultDocument);
    };
    const timer = setInterval(() => {
      void poll().catch(() => {});
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [section, busy, dirty]);
  const run = async (
    fn: () => Promise<void>,
    message = "Saved successfully.",
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const loadLibrary = async () => {
    if (libraryPending.current) return libraryPending.current;
    const task = (async () => {
      const r = await fetch("/api/admin/media", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLibrary(d); libraryLoaded.current = true;
    })();
    libraryPending.current = task;
    try { await task; } finally { libraryPending.current = null; }
  };
  useEffect(() => {
    if (["media","products","hero","content"].some(can) && ["media", "hero", "products"].includes(section) && !libraryLoaded.current)
      void loadLibrary().catch((e) => setError(e.message));
  }, [section]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || productDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, productDirty]);
  const saveSite = (publish: boolean) =>
    run(
      async () => {
        const editedAt = editVersion.current;
        const saved = await adminRequest({
          action: "site",
          input: { document, version: snapshot.site.version, publish },
        });
        setSnapshot((s) => ({
          ...s,
          site: {
            ...s.site,
            version: saved.result,
            draft: document,
            published: publish ? document : s.site.published,
          },
        }));
        if (editVersion.current === editedAt) { siteDirty.current = false; setDirty(false); }
        void refresh().catch(() => {});
      },
      publish
        ? snapshot.connection?.content === "supabase"
          ? "Published. Your changes are live. Open store tabs update automatically."
          : "Saved, but your website is not connected to these updates yet. Ask your website manager to finish connecting it."
        : "Draft saved. The live website stays unchanged until you publish.",
    );
  const records = (kind: RecordKind) =>
    snapshot.records.filter((r) => r.kind === kind);
  const visibleFeatured = document.featured.filter((id) =>
    snapshot.products.some(
      (p) => p.design_reference === id && p.status === "published",
    ),
  );
  const saveRecord = (kind: RecordKind, data: unknown, record?: AdminRecord) =>
    run(async () => {
      await adminRequest({
        action: "record",
        input: {
          kind,
          data,
          id: record?.id || null,
          version: record?.version || 0,
        },
      });
      await refresh();
    });
  const removeRecord = (record: AdminRecord) => {
    if (confirm(`Delete this ${record.kind}? This cannot be undone.`))
      void run(async () => {
        await adminRequest({
          action: "delete",
          input: { id: record.id, version: record.version },
        });
        await refresh();
      }, "Record deleted.");
  };
  const orders = records("order");
  const expenses = records("expense");
  const received =
    snapshot.statistics?.paidPence ??
    orders
      .filter(
        (r) =>
          r.payload.payment_status === "paid" && r.payload.is_test !== true,
      )
      .reduce(
        (s, r) =>
          s +
          Number(r.payload.total_pence || 0) -
          Number(r.payload.refunded_pence || 0),
        0,
      );
  const spent =
    snapshot.statistics?.expensePence ??
    expenses.reduce((s, r) => s + Number(r.payload.amount_pence || 0), 0);
  const restricted = !sectionAllowed(access, section);
  const editableCopy = useMemo(() => customerCopy(copyRegistry), []);
  const filteredCopy = useMemo(() => editableCopy.filter(c =>
    (c.text !== "info@seenabayas.co.uk" || can("settings.business")) &&
    (group === "all" || c.places.some(place => place.name === group)) &&
    (c.text.toLowerCase().includes(query.toLowerCase()) || (document.text[c.text] || "").toLowerCase().includes(query.toLowerCase()))
  ), [editableCopy, group, query, document.text, access.mainAdmin, access.permissions]);
  const groups = useMemo(() => [...new Set(editableCopy.flatMap(c => c.places.map(p => p.name)))].sort(), [editableCopy]);
  const destination = group !== "all" && section === "content"
    ? editableCopy.flatMap(c => c.places).find(p => p.name === group)
    : sectionDestinations[section];
  const destinationPath = destination?.path || "/";
  const [previewVersion, setPreviewVersion] = useState(0);
  const previousPath = useRef(pathname);
  useEffect(() => { previousPath.current = pathname; }, [pathname]);
  useEffect(() => {
    const back = () => {
      if (busy || ((dirty || productDirty) && !confirm("Leave this page and discard unsaved changes?"))) {
        window.history.pushState(null, "", previousPath.current); return;
      }
      if (dirty) { const saved = siteDocumentSchema.safeParse(snapshot.site.draft); setDocument(saved.success ? saved.data : defaultDocument); siteDirty.current = false; setDirty(false); }
      setProductDirty(false);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [dirty, productDirty, busy, snapshot.site.draft]);
  useEffect(() => { setQuery(""); setGroup("all"); setLimit(30); setNotice(""); setError(""); setPreviewOpen(false); }, [section]);
  const navigate = (event: MouseEvent<HTMLAnchorElement>, target: AdminSection) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (busy) return;
    if ((dirty || productDirty) && !confirm("Leave this page and discard unsaved changes?")) return;
    if (dirty) { const saved = siteDocumentSchema.safeParse(snapshot.site.draft); setDocument(saved.success ? saved.data : defaultDocument); siteDirty.current = false; setDirty(false); }
    setOpen(false);
    setProductDirty(false);
    window.history.pushState(null, "", target === "dashboard" ? "/admin" : `/admin/${target}`);
    requestAnimationFrame(() => { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); });
  };
  return (
    <AdminMediaProvider files={library} reload={loadLibrary} canManage={can("media")}>
      <div className="admin-workspace" data-admin>
        {open && (
          <button
            className="admin-nav-backdrop"
            aria-label="Close menu overlay"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          className="admin-sidebar"
          ref={sidebarRef}
          data-open={open}
          inert={mobile && !open}
        >
          <a href="/admin" className="admin-wordmark">
            SEEN<span>STORE MANAGEMENT</span>
          </a>
          <button
            className="admin-nav-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
          <nav aria-label="Administration">
            {adminNavigation.filter(category => category.sections.some(s => sectionAllowed(access, s))).map(category => <div className="admin-nav-group" key={category.label}>
              <p className="admin-nav-label">{category.label}</p>
              {category.sections.filter(s => sectionAllowed(access, s)).map(s => <Link prefetch={false} key={s}  href={s === "dashboard" ? "/admin" : `/admin/${s}`}
                aria-current={section === s ? "page" : undefined} onClick={event => navigate(event, s)}>
                <span className="admin-nav-dot" aria-hidden="true" />{sectionNames[s]}
                {s === "inbox" && records("message").some(r => !r.payload.read) && <span className="admin-unread" />}
              </Link>)}
            </div>)}
          </nav>
          <a
            className="admin-view-store"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            View the store
            <ArrowUpRight size={17} />
          </a>
          <div className="admin-profile">
            <span>{email}</span>
            <small>{access.mainAdmin ? "Main administrator" : "Administrator"}</small>
            <button
              onClick={() =>
                void run(async () => {
                  await adminRequest({ action: "logout" }, "/api/admin/auth");
                  window.location.assign("/admin/login");
                })
              }
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="admin-main" inert={mobile && open}>
          <header className="admin-topbar">
            <button
              ref={menuRef}
              className="admin-menu-toggle"
              aria-label="Open admin navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>SEEN / WORKSPACE</span>
            <button disabled={busy || dirty || productDirty} onClick={() => void run(async () => {
              const next = await refresh(); const saved = siteDocumentSchema.safeParse(next.site.draft);
              setDocument(saved.success ? saved.data : defaultDocument);
              if (libraryLoaded.current) await loadLibrary();
            }, "Workspace refreshed.")}>Refresh workspace</button>
            <a href="/admin/preview" target="_blank" rel="noreferrer">
              <Eye size={15} />
              Preview draft
            </a>
          </header>
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">Your store, considered.</p>
              <h1 ref={headingRef} tabIndex={-1}>{sectionNames[section]}</h1>
              <p>
                {sectionDescriptions[section]}
              </p>
            </div>
            {section === "products" && !restricted && (
              <button
                className="admin-primary"
                disabled={busy}
                onClick={() => setCreateProductRequest((n) => n + 1)}
              >
                <Plus size={16} /> Add product
              </button>
            )}
            {contentSections.includes(section) && !restricted && (
              <div className="admin-actions">
                <Status>
                  {dirty
                    ? "Unsaved changes"
                    : `Revision ${snapshot.site.version}`}
                </Status>
                <button disabled={busy} onClick={() => void saveSite(false)}>
                  <Save size={15} />
                  Save draft
                </button>
                {can("publish") && <button
                  className="admin-primary"
                  disabled={busy}
                  onClick={() => void saveSite(true)}

                >
                  Save & update store
                  <ArrowUpRight size={15} />
                </button>}
              </div>
            )}
          </div>
          {snapshot.connection && (
            <div
              className="admin-connection"
              data-ready={
                snapshot.connection.catalog === "supabase" &&
                snapshot.connection.content === "supabase" &&
                snapshot.connection.sync === "ready"
              }
            >
              <strong>
                {snapshot.connection.catalog === "supabase" &&
                snapshot.connection.content === "supabase"
                  ? "Your live website is connected"
                  : "Website connection needs attention"}
              </strong>
              <p>
                {snapshot.connection.catalog !== "supabase" ||
                snapshot.connection.content !== "supabase"
                  ? "Your changes are saved here, but the website is not connected to them yet. Ask your website manager to finish the connection."
                  : snapshot.connection.sync === "migration-required"
                    ? "Products and content are connected. Your website manager needs to finish the live-update setup so all categories appear."
                    : snapshot.connection.sync === "offline"
                      ? "We could not check the live website connection. Try refreshing the workspace."
                      : "Products and categories update when saved. Website text, images and settings update with Save & update store. Open store tabs refresh automatically."}
              </p>
            </div>
          )}
          <div ref={feedbackRef} className="admin-feedback" aria-live="polite">
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="admin-success">
                <Check size={16} />
                {notice}
              </p>
            )}
            {busy && <p>Saving securely…</p>}
          </div>
          {destination && <section className="admin-effect-bar" aria-label="Where your changes appear">
            <div><span>Changes appear on</span><strong>{destination.name}</strong><p>{section === "products" || section === "categories" ? "Saved visible products and categories update your shop. Hidden products stay private." : "Save & update store publishes your changes. Save draft keeps them private."}</p></div>
            <div className="admin-effect-actions"><a href={destinationPath} target="_blank" rel="noreferrer">View live page <ArrowUpRight size={14} /></a>
              <button onClick={() => setPreviewOpen(!previewOpen)} aria-expanded={previewOpen}><Eye size={15} />{previewOpen ? "Close preview" : "Preview saved draft"}</button></div>
          </section>}
          {previewOpen && destination && <section className="admin-preview-panel">
            <div className="admin-toolbar"><strong>Saved draft preview</strong><span>Save draft first to see your latest edits here.</span>
              <button onClick={() => setPreviewWidth("phone")} aria-pressed={previewWidth === "phone"}>Phone</button><button onClick={() => setPreviewWidth("desktop")} aria-pressed={previewWidth === "desktop"}>Desktop</button><button onClick={() => setPreviewVersion(v => v + 1)}>Refresh preview</button>
              <a href={`/admin/preview${destinationPath === "/" ? "" : destinationPath}`} target="_blank" rel="noreferrer">Open preview <ArrowUpRight size={13} /></a></div>
            <iframe title="Saved website draft" key={`${destinationPath}-${previewVersion}`} src={`/admin/preview${destinationPath === "/" ? "" : destinationPath}`} data-size={previewWidth} />
          </section>}
          <AdminPageHelp section={section} />
          {restricted ? (
            <Panel title="Access not assigned">
              <p>
                Ask the main administrator to assign this section to your account.
              </p>
            </Panel>
          ) : (
            <>
              {section === "dashboard" && access.mainAdmin && (
                <>
                  <Stats
                    values={[
                      {
                        label: "Collection",
                        value: snapshot.products.length,
                        note: `${snapshot.products.filter((p) => p.status === "published").length} published pieces`,
                      },
                      {
                        label: "Available stock",
                        value: snapshot.products.reduce(
                          (s, p) =>
                            s +
                            p.variants
                              .filter((v) => v.active)
                              .reduce((n, v) => n + v.on_hand - v.reserved, 0),
                          0,
                        ),
                        note: "Across active sizes",
                      },
                      {
                        label: "Orders",
                        value:
                          snapshot.statistics?.orderCount ??
                          orders.filter((r) => r.payload.is_test !== true)
                            .length,
                        note: "Customer orders, excluding sandbox tests",
                      },
                      {
                        label: "Net payments received",
                        value: formatGbp(received),
                        note: "Verified paid orders, less recorded refunds",
                      },
                    ]}
                  />
                  <div className="admin-two-col">
                    <Panel
                      title="The collection, at a glance"
                      description="Manage the pieces your customers will discover."
                    >
                      {snapshot.products.slice(0, 5).map((p) => (
                        <a
                          className="admin-list-row"
                          href="/admin/products"
                          onClick={event => navigate(event, "products")}
                          key={p.id}
                        >
                          <span>
                            {p.name || p.design_reference}
                            <small>{p.design_reference}</small>
                          </span>
                          <Status>{p.status}</Status>
                        </a>
                      ))}
                      <Link prefetch={false}
                        className="admin-inline-link"
                        href="/admin/products"
                        onClick={event => navigate(event, "products")}
                      >
                        Manage products
                        <ArrowUpRight size={16} />
                      </Link>
                    </Panel>
                    <Panel
                      title="Your publishing desk"
                      description="Drafts give you room to refine before going live."
                    >
                      <p className="admin-large-number">
                        {snapshot.site.version.toString().padStart(2, "0")}
                      </p>
                      <p>Content revision</p>
                      <p className="admin-caption">
                        {snapshot.site.published_at
                          ? `Last published ${new Date(snapshot.site.published_at).toLocaleString("en-GB")}`
                          : "Your original website design is active. Publish your first update when ready."}
                      </p>
                      <Link prefetch={false} className="admin-inline-link" href="/admin/content" onClick={event => navigate(event, "content")}>
                        Edit website copy
                        <ArrowUpRight size={16} />
                      </Link>
                    </Panel>
                  </div>
                  <Panel title="What would you like to do?" description="Choose a task to go straight to its controls.">
                    <div className="admin-quick-tasks">{([
                      ["products", "Add or change a product", "Photos, prices, sizes and stock"],
                      ["content", "Change website wording", "Pick a page and edit what customers read"],
                      ["hero", "Change the homepage video", "Upload or choose a film"],
                      ["settings", "Change delivery or the banner", "Fees, free delivery and your top announcement"],
                      ["orders", "Prepare customer orders", "Purchased items, addresses and tracking"],
                      ["security", "Manage your account", "Password, email and administrator access"],
                    ] as const).filter(([target]) => sectionAllowed(access, target)).map(([target, title, note]) => <Link prefetch={false} key={target}  href={`/admin/${target}`} onClick={event => navigate(event, target)}><strong>{title}<ArrowUpRight size={15} /></strong><span>{note}</span></Link>)}</div>
                  </Panel>
                  {access.mainAdmin && <ConnectionChecks />}

                </>
              )}
              {section === "dashboard" && !access.mainAdmin && <Panel title="Your workspace" description="You can manage the sections assigned by the main administrator. Your own password and recovery email are always available."><div className="admin-quick-tasks">{adminSections.filter(target => target !== "dashboard" && sectionAllowed(access,target)).map(target => <Link prefetch={false} key={target} href={`/admin/${target}`} onClick={event => navigate(event,target)}><strong>{sectionNames[target]}</strong><span>{sectionDescriptions[target]}</span></Link>)}</div></Panel>}
              {section === "products" && (
                <ProductManager
                  createRequest={createProductRequest}
                  onDirtyChange={setProductDirty}
                  canDelete={can("products.delete")}
                  canUpload={can("media")}
                  products={snapshot.products}
                  categories={records("category")}
                  library={library}
                  busy={busy}
                  execute={run}
                  refresh={refresh}
                />
              )}
              {section === "categories" && (
                <>
                  <EntityForm
                    kind="category"
                    onSave={(d, r) => saveRecord("category", d, r)}
                    busy={busy}
                  />
                  <RecordList
                    records={records("category")}
                    remove={removeRecord}
                    save={(d, r) => saveRecord("category", d, r)}
                    busy={busy}
                  />
                </>
              )}
              {section === "coupons" && (
                <>
                  <Panel
                    title="Discount codes"
                    description="Customers can apply one code in their bag or checkout. Choose a product discount or free standard delivery."
                  >
                    <p>
                      Fixed discount values and minimum subtotals are in pounds
                      (£). For percentage discounts, enter a whole number from 1
                      to 100.
                    </p>
                  </Panel>
                  <EntityForm
                    kind="coupon"
                    onSave={(d, r) => saveRecord("coupon", d, r)}
                    busy={busy}
                  />
                  <RecordList
                    records={records("coupon")}
                    remove={removeRecord}
                    save={(d, r) => saveRecord("coupon", d, r)}
                    busy={busy}
                  />
                </>
              )}
              {section === "finance" && (
                <>
                  <Stats
                    values={[
                      {
                        label: "Net payments received",
                        value: formatGbp(received),
                      },
                      { label: "Recorded expenses", value: formatGbp(spent) },
                      {
                        label: "Cash after expenses",
                        value: formatGbp(received - spent),
                        note: "Excludes unrecorded costs, VAT and stock costs",
                      },
                    ]}
                  />
                  <EntityForm
                    kind="expense"
                    onSave={(d, r) => saveRecord("expense", d, r)}
                    busy={busy}
                  />
                  <RecordList
                    records={expenses}
                    remove={removeRecord}
                    save={(d, r) => saveRecord("expense", d, r)}
                    busy={busy}
                  />
                </>
              )}
              {section === "orders" && (
                <OrderManager
                  records={orders}
                  busy={busy}
                  reconcile={() =>
                    run(async () => {
                      const response = await fetch(
                        "/api/admin/payments/reconcile",
                        { method: "POST" },
                      );
                      const result = await response.json();
                      if (!response.ok)
                        throw new Error(
                          result.error || "Payment refresh failed.",
                        );
                      await refresh();
                      if (result.retryRequired)
                        throw new Error(
                          "Some payments still need another check. Their reservations have been retained safely.",
                        );
                    }, "Stripe payment statuses checked. Test payments are excluded from commercial totals.")
                  }
                  save={(d, r) => saveRecord("order", d, r)}
                />
              )}
              {section === "inbox" && (
                <Inbox
                  records={records("message")}
                  busy={busy}
                  save={(d, r) => saveRecord("message", d, r)}
                  remove={removeRecord}
                />
              )}
              {section === "hero" && (
                <Panel
                  title="Your moving first impression"
                  description="The full-screen video and moving SEEN logo remain the primary homepage design. Add clips to play in sequence, or keep one film on repeat."
                >
                  <div className="admin-two-col">
                    <div className="admin-form-stack">
                      {document.hero.videos.map((src, i) => (
                        <div className="admin-media-row" key={`${i}-${src}`}>
                          <Field label={`Film ${i + 1}`}>
                            <AssetSelect
                              value={src}
                              onChange={(v) =>
                                editSite({
                                  ...document,
                                  hero: {
                                    ...document.hero,
                                    videos: document.hero.videos.map((s, n) =>
                                      n === i ? v : s,
                                    ),
                                  },
                                })
                              }
                              library={library}
                              type="video"
                            />
                          </Field>
                          <button
                            aria-label={`Move film ${i + 1} up`}
                            disabled={i === 0}
                            onClick={() => {
                              const clips = [...document.hero.videos];
                              [clips[i - 1], clips[i]] = [
                                clips[i],
                                clips[i - 1],
                              ];
                              editSite({
                                ...document,
                                hero: { ...document.hero, videos: clips },
                              });
                            }}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            aria-label={`Remove film ${i + 1}`}
                            disabled={document.hero.videos.length === 1}
                            onClick={() =>
                              editSite({
                                ...document,
                                hero: {
                                  ...document.hero,
                                  videos: document.hero.videos.filter(
                                    (_, n) => n !== i,
                                  ),
                                },
                              })
                            }
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                      <button
                        disabled={document.hero.videos.length >= 8}
                        onClick={() =>
                          editSite({
                            ...document,
                            hero: {
                              ...document.hero,
                              videos: [
                                ...document.hero.videos,
                                "/videos/home/hero.mp4",
                              ],
                            },
                          })
                        }
                      >
                        <Plus size={15} />
                        Add another clip
                      </button>
                      <div className="admin-field">
                        <span>Poster image</span>
                        <AssetSelect
                          value={document.hero.poster}
                          onChange={(v) =>
                            editSite({
                              ...document,
                              hero: { ...document.hero, poster: v },
                            })
                          }
                          library={library}
                          type="image"
                        />
                      </div>
                      <p className="admin-caption">
                        Muted autoplay, mobile framing, poster fallback and
                        reduced-motion behaviour are preserved. Upload new clips
                        in Media library.
                      </p>
                      <Field label="Collection button destination">
                        <input
                          value={document.hero.ctaLink}
                          onChange={(event) =>
                            editSite({
                              ...document,
                              hero: {
                                ...document.hero,
                                ctaLink: event.target.value,
                              },
                            })
                          }
                          placeholder="/collection"
                        />
                      </Field>
                    </div>
                    <video
                      className="admin-video-preview"
                      src={document.hero.videos[0]}
                      poster={document.hero.poster}
                      controls
                      playsInline
                      muted
                      preload="metadata"
                    />
                  </div>
                </Panel>
              )}
              {section === "media" && (
                <>
                  <MediaLibrary
                    files={library}
                    busy={busy}
                    execute={run}
                    reload={loadLibrary}
                    onUse={(src) => {
                      if (document.sections.length >= 24) {
                        setError(
                          "Remove an existing page media section before adding another. You can keep up to 24 sections.",
                        );
                        return;
                      }
                      editSite({
                        ...document,
                        sections: [
                          ...document.sections,
                          createMediaSection(src),
                        ].slice(0, 24),
                      });
                      window.setTimeout(
                        () =>
                          window.document
                            .getElementById("page-media-editor")
                            ?.scrollIntoView({
                              block: "start",
                              behavior: "smooth",
                            }),
                        0,
                      );
                    }}
                  />
                  <MediaSectionsEditor
                    sections={document.sections}
                    onChange={(sections) => editSite({ ...document, sections })}
                    products={snapshot.products}
                  />
                  <Panel
                    title="Replace existing website images"
                    description="Choose a replacement for existing product or brand photography. These replacements apply everywhere the original asset appears after publishing."
                  >
                    <div className="admin-media-grid">
                      {[
                        "/images/brand/seen-signature.svg",
                        "/images/brand/logo.webp",
                        ...collectionPieces.flatMap((p) =>
                          p.photos.map((ph) => ph.src),
                        ),
                      ].map((src) => (
                        <div key={src} className="admin-asset-card">
                          <img
                            src={document.media[src] || src}
                            alt="Current website asset"
                            loading="lazy"
                          />
                          <code>{src.split("/").pop()}</code>
                          <AssetSelect
                            value={document.media[src] || src}
                            onChange={(v) =>
                              editSite({
                                ...document,
                                media: { ...document.media, [src]: v },
                              })
                            }
                            library={library}
                            type="image"
                          />
                          <button
                            onClick={() => {
                              const media = { ...document.media };
                              delete media[src];
                              editSite({ ...document, media });
                            }}
                          >
                            Restore original
                          </button>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </>
              )}
              {section === "content" && (
                <Panel
                  title="Every word, with intention"
                  description="Edit the site's headings, paragraphs, navigation labels and customer-facing messages. Matching shared text is updated consistently across pages."
                >
                  <div className="admin-toolbar">
                    <input
                      type="search"
                      placeholder="Find words or phrases…"
                      aria-label="Search website text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setLimit(50);
                      }}
                    />
                    <select
                      aria-label="Filter text by page"
                      value={group}
                      onChange={(e) => {
                        setGroup(e.target.value);
                        setLimit(50);
                      }}
                    >
                      <option value="all">All website pages</option>
                      {groups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <span>{filteredCopy.length} entries</span>
                  </div>
                  <div className="admin-copy-fields">
                    {filteredCopy.slice(0, limit).map((c) => (
                      <div className="admin-copy-field" key={c.text}>
                        <div>
                          <small>Appears on: {c.places.map(p => p.name).join(" · ")}</small>
                          <a className="admin-copy-location" href={c.places[0].path} target="_blank" rel="noreferrer">View this page <ArrowUpRight size={12} /></a>
                          <p>{c.text}</p>
                        </div>
                        <label>
                          <span className="sr-only">
                            Replacement for {c.text}
                          </span>
                          <textarea
                            rows={c.text.length > 150 ? 4 : 2}
                            value={document.text[c.text] ?? c.text}
                            maxLength={8000}
                            onChange={(e) =>
                              editSite({
                                ...document,
                                text: {
                                  ...document.text,
                                  [c.text]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <button
                          aria-label={`Restore original: ${c.text.slice(0, 60)}`}
                          onClick={() => {
                            const text = { ...document.text };
                            delete text[c.text];
                            editSite({ ...document, text });
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    ))}
                  </div>
                  {filteredCopy.length > limit && (
                    <button onClick={() => setLimit((v) => v + 50)}>
                      Show more text
                    </button>
                  )}
                </Panel>
              )}
              {section === "appearance" && (
                <>
                  {can("appearance.colours") && <Panel
                    title="A palette with presence"
                    description="Use restrained colours that keep text clear against the background."
                  >
                    <div className="admin-fields">
                      {(["ink", "paper", "accent"] as const).map((key) => (
                        <Field key={key} label={key}>
                          <input
                            type="color"
                            value={document.appearance[key]}
                            onChange={(e) =>
                              editSite({
                                ...document,
                                appearance: {
                                  ...document.appearance,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <div
                      className="admin-palette-preview"
                      style={{
                        background: document.appearance.paper,
                        color: document.appearance.ink,
                        borderColor: document.appearance.accent,
                      }}
                    >
                      <span>SEEN ABAYAS</span>
                      <p>Made to Be Seen.</p>
                      <span style={{ color: document.appearance.accent }}>
                        A considered expression of elegance.
                      </span>
                    </div>
                  </Panel>}
                  {can("appearance.motion") && <Panel
                    title="The motion collection"
                    description="Choose how sections appear as customers scroll and how buttons respond. These settings respect reduced-motion preferences."
                  >
                    <div className="admin-fields">
                      <Field label="Scroll reveals">
                        <select
                          value={document.appearance.motion}
                          onChange={(e) =>
                            editSite({
                              ...document,
                              appearance: {
                                ...document.appearance,
                                motion: e.target
                                  .value as SiteDocument["appearance"]["motion"],
                              },
                            })
                          }
                        >
                          {["subtle", "editorial", "cinematic", "none"].map(
                            (s) => (
                              <option key={s}>{s}</option>
                            ),
                          )}
                        </select>
                      </Field>
                      <Field label="Button & link hover">
                        <select
                          value={document.appearance.hover}
                          onChange={(e) =>
                            editSite({
                              ...document,
                              appearance: {
                                ...document.appearance,
                                hover: e.target
                                  .value as SiteDocument["appearance"]["hover"],
                              },
                            })
                          }
                        >
                          {["lift", "magnetic", "sheen", "none"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <MotionDemo appearance={document.appearance} />
                  </Panel>}
                  {can("appearance.featured") && <Panel
                    title="Homepage edit"
                    description="Select up to four visible products in display order. Uncheck a selected piece to make room for another. Hide this section to remove the homepage edit."
                  >
                    <div className="admin-check-list">
                      {snapshot.products
                        .filter((p) => p.status === "published")
                        .map((p) => (
                          <label key={p.id}>
                            <input
                              type="checkbox"
                              disabled={
                                !visibleFeatured.includes(p.design_reference) &&
                                visibleFeatured.length >= 4
                              }
                              checked={visibleFeatured.includes(
                                p.design_reference,
                              )}
                              onChange={(e) =>
                                editSite({
                                  ...document,
                                  featured: e.target.checked
                                    ? [
                                        ...visibleFeatured,
                                        p.design_reference,
                                      ].slice(0, 4)
                                    : visibleFeatured.filter(
                                        (id) => id !== p.design_reference,
                                      ),
                                })
                              }
                            />
                            {p.name || p.design_reference}
                          </label>
                        ))}
                    </div>
                    {!snapshot.products.some(
                      (p) => p.status === "published",
                    ) && (
                      <p>
                        Publish a product in Products & stock to choose it here.
                      </p>
                    )}
                    <button
                      onClick={() => editSite({ ...document, featured: [] })}
                    >
                      Hide homepage edit
                    </button>
                  </Panel>}
                </>
              )}
              {section === "settings" && (
                <>
                  {can("settings.announcement") && <Panel title="Delivery announcement">
                    <div className="admin-form-stack">
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={document.announcement.enabled}
                          onChange={(e) =>
                            editSite({
                              ...document,
                              announcement: {
                                ...document.announcement,
                                enabled: e.target.checked,
                              },
                            })
                          }
                        />
                        Show animated announcement
                      </label>
                      <Field label="Banner message">
                        <input
                          value={document.announcement.text}
                          maxLength={180}
                          onChange={(e) =>
                            editSite({
                              ...document,
                              announcement: {
                                ...document.announcement,
                                text: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <div className="admin-fields">
                        <Field label="Banner background">
                          <input
                            type="color"
                            value={document.announcement.background}
                            onChange={(e) =>
                              editSite({
                                ...document,
                                announcement: {
                                  ...document.announcement,
                                  background: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label="Banner text colour">
                          <input
                            type="color"
                            value={document.announcement.ink}
                            onChange={(e) =>
                              editSite({
                                ...document,
                                announcement: {
                                  ...document.announcement,
                                  ink: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label="Banner loop duration (seconds)">
                          <input
                            type="number"
                            min={15}
                            max={90}
                            value={document.announcement.duration}
                            onChange={(e) =>
                              editSite({
                                ...document,
                                announcement: {
                                  ...document.announcement,
                                  duration: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Destination">
                        <input
                          value={document.announcement.link}
                          onChange={(e) =>
                            editSite({
                              ...document,
                              announcement: {
                                ...document.announcement,
                                link: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <p className="admin-caption">
                        Use {"{threshold}"} to keep the banner amount linked to
                        your free delivery threshold. Save & update store publishes
                        the banner and delivery settings together.
                      </p>
                      <button type="button" onClick={() => editSite({
                        ...document,
                        announcement: { ...document.announcement, text: defaultDocument.announcement.text },
                      })}>Use automatic delivery message</button>
                      <output aria-label="Banner preview" className="admin-banner-preview"
                        style={{ background: document.announcement.background, color: document.announcement.ink }}>
                        {announcementTextFor(document)}
                      </output>
                      {!document.announcement.enabled && <p className="admin-caption">Banner hidden on the store. Preview shown above.</p>}
                      {!document.commerce.freeDeliveryEnabled && document.announcement.text !== defaultDocument.announcement.text &&
                        document.announcement.text !== "Complimentary UK delivery on orders over {threshold}" &&
                        <p className="admin-caption">The free delivery offer is disabled. Check that your custom banner describes the current offer accurately.</p>}
                    </div>
                  </Panel>}
                  {can("settings.delivery") && <Panel
                    title="Shipping & order settings"
                    description="Set the customer delivery fee in pounds and the merchandise subtotal that qualifies for free standard delivery. Checkout, the bag and the automatic banner use the same published settings."
                  >
                    <div className="admin-fields">
                      <Field label="Standard delivery charge (£)">
                        <MoneyInput value={currentPolicies.delivery.standardChargePence}
                          placeholder="Not set"
                          aria-describedby="standard-delivery-help"
                          onChange={(pence) => editSite({ ...document, policies: {
                            ...currentPolicies, delivery: { ...currentPolicies.delivery, standardChargePence: pence },
                          } })} />
                      </Field>
                      <Field label="Complimentary UK delivery">
                        <select
                          value={String(document.commerce.freeDeliveryEnabled)}
                          onChange={(e) =>
                            editSite({
                              ...document,
                              commerce: {
                                ...document.commerce,
                                freeDeliveryEnabled: e.target.value === "true",
                              },
                            })
                          }
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      </Field>
                      <Field label="Free delivery threshold (£)">
                        <MoneyInput
                          value={document.commerce.freeDeliveryThresholdPence}
                          onChange={(pence) =>
                            editSite({
                              ...document,
                              commerce: {
                                ...document.commerce,
                                freeDeliveryThresholdPence: pence ?? 0,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Minimum order (£)">
                        <MoneyInput
                          value={document.commerce.minimumOrderPence}
                          onChange={(pence) =>
                            editSite({
                              ...document,
                              commerce: {
                                ...document.commerce,
                                minimumOrderPence: pence ?? 0,
                              },
                            })
                          }
                        />
                      </Field>
                    </div>
                    <p id="standard-delivery-help" className="admin-caption">
                      Enter 0 for no standard delivery charge. Leave blank only while
                      undecided: orders that do not qualify for free delivery cannot pay
                      until a charge is set. This is the fee you charge customers;
                      purchasing Royal Mail postage is separate.
                    </p>
                    <output aria-label="Delivery rule summary" className="admin-caption">
                      {document.commerce.freeDeliveryEnabled
                        ? `Standard delivery is free at ${deliveryThresholdFor(document)} or more. Below this subtotal: `
                        : "Free delivery offer disabled. Standard delivery for all orders: "}
                      {currentPolicies.delivery.standardChargePence === null
                        ? "charge not set; payment blocked for non-qualifying orders."
                        : `${formatGbp(currentPolicies.delivery.standardChargePence)}.`}
                      {" Express upgrades keep their separate charge. Existing Stripe checkouts keep their original quoted total."}
                    </output>
                  </Panel>}
                  {can("settings.delivery") && <ShippingSettingsEditor value={document.shipping} products={snapshot.products}
                    onChange={shipping => editSite({ ...document, shipping })} />}
                  {["business","delivery","privacy","review"].some(group => can(`settings.${group}`)) && <PolicyEditor
                    allowedGroups={["business","delivery","privacy","review"].filter(group => can(`settings.${group}`))}
                    value={document.policies}
                    onChange={(v) => editSite({ ...document, policies: v })}
                  />}
                  <Panel title="Integrations">
                    <p>
                      Your store keeps accounts, website changes, stock and uploaded files together.
                      Contact enquiries go to the private Admin Inbox. Your email service
                      sends purchase emails when enabled. Provider secrets are managed in hosting
                      environment variables and never exposed in this editor.
                    </p>
                    <p>
                      Your payment provider collects customer payments. The standard delivery fee
                      above does not buy a Royal Mail label. Automatic Royal Mail labels
                      remain a separate fulfilment integration.
                    </p>
                  </Panel>
                </>
              )}
              {section === "history" && (
                <>
                  <Panel
                    title="Published revisions"
                    description="Restore a previous publication into the draft. Review it before publishing again."
                  >
                    {snapshot.history.length ? (
                      snapshot.history.map((h) => (
                        <div className="admin-list-row" key={h.version}>
                          <span>
                            Revision {h.version}
                            <small>
                              {new Date(h.created_at).toLocaleString("en-GB")}
                            </small>
                          </span>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await adminRequest({
                                  action: "restore",
                                  version: h.version,
                                  currentVersion: snapshot.site.version,
                                });
                                const fresh = await refresh();
                                setDocument(
                                  siteDocumentSchema.parse(fresh.site.draft),
                                );
                                setDirty(false);
                              }, "Revision restored to draft.")
                            }
                          >
                            Restore to draft
                          </button>
                        </div>
                      ))
                    ) : (
                      <Empty text="Your first publication will appear here." />
                    )}
                  </Panel>
                  <Panel
                    title="Recent activity"
                    description="The latest 100 administrative changes. Customer message content and secrets are excluded."
                  >
                    {snapshot.audit.map((a) => (
                      <div className="admin-list-row" key={a.id}>
                        <span>
                          {a.action} · {a.entity}
                          <small>{a.entity_id}</small>
                        </span>
                        <time>
                          {new Date(a.created_at).toLocaleString("en-GB")}
                        </time>
                      </div>
                    ))}
                  </Panel>
                </>
              )}
              {section === "security" && (
                <>
                  <AccountTeam owner={access.mainAdmin} />
                  <SecuritySettings
                    email={email}
                    role={access.mainAdmin ? "Main administrator" : "Administrator"}
                    busy={busy}
                    execute={run}
                  />
                  <ChangeEmail />
                </>
              )}
            </>
          )}
          {snapshot.statistics &&
            snapshot.statistics.recordCount > snapshot.records.length && (
              <p className="admin-caption">
                Lists currently show the latest {snapshot.records.length}{" "}
                records across the workspace. Financial totals include all
                records. See the setup guide before managing a larger archive.
              </p>
            )}
          <footer className="admin-footer">
            SEEN ABAYAS<span>Private administration · GBP</span>
          </footer>
        </div>
      </div>
    </AdminMediaProvider>
  );
}

function AssetSelect({
  value,
  onChange,
  library,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  library: LibraryFile[];
  type: "image" | "video";
}) {
  const originals =
    type === "video"
      ? ["/videos/home/hero.mp4"]
      : [
          "/images/home/hero-poster.webp",
          ...collectionPieces.flatMap((p) => p.photos.map((ph) => ph.src)),
        ];
  const values = [
    ...new Set([
      value,
      ...originals,
      ...library
        .filter((f) =>
          type === "video" ? f.name.endsWith(".mp4") : !f.name.endsWith(".mp4"),
        )
        .map((f) => f.src),
    ]),
  ];
  return (
    <div className="admin-asset-select">
      <select
        aria-label={`Select ${type}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {values.map((s) => (
          <option key={s} value={s}>
            {s.split("/").pop()}
          </option>
        ))}
      </select>
      <MediaChoiceButton kind={type} value={value} onChange={onChange} />
    </div>
  );
}

function ProductManager({
  createRequest,
  onDirtyChange,
  canDelete,
  canUpload,
  products,
  categories,
  library,
  busy,
  execute,
  refresh,
}: {
  createRequest: number;
  onDirtyChange: (dirty: boolean) => void;
  canDelete: boolean;
  canUpload: boolean;
  products: AdminProduct[];
  categories: AdminRecord[];
  library: LibraryFile[];
  busy: boolean;
  execute: (
    fn: () => Promise<void>,
    message?: string,
  ) => Promise<void | boolean>;
  refresh: () => Promise<AdminSnapshot>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<AdminProduct | undefined>();
  const [form, setForm] = useState<ReturnType<typeof newProduct> | null>(null);
  const originalForm = useRef<string | null>(null);
  useEffect(() => {
    if (!form) { originalForm.current = null; onDirtyChange(false); return; }
    const value = JSON.stringify(form);
    if (originalForm.current === null) originalForm.current = value;
    onDirtyChange(originalForm.current !== value);
  }, [form, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState(5);
  const [validation, setValidation] = useState("");
  const productNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!form) return;
    productNameRef.current?.focus({ preventScroll: true });
    productNameRef.current
      ?.closest("section")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [Boolean(form), editing?.id]);
  function newProduct() {
    return {
      design_reference: `design-${String(Math.max(7, ...products.map((p) => Number(p.design_reference.slice(7)))) + 1).padStart(2, "0")}`,
      name: "",
      description: "",
      price_pence: null as number | null,
      cost_pence: null as number | null,
      status: "published" as "draft" | "published" | "archived",
      details_confirmed: false,
      sort_order: products.length + 1,
      photos: [] as { src: string; alt: string; label: string }[],
      category: "",
      tone: "",
      variants: ["52", "54", "56", "58", "60"].map((size) => ({
        id: undefined as string | undefined,
        size_label: size,
        sku: "",
        active: true,
        on_hand: 0,
      })),
    };
  }
  const open = (product?: AdminProduct) => {
    if (form && originalForm.current !== JSON.stringify(form) && !confirm("Discard the unsaved product changes?")) return;
    originalForm.current = null;
    setEditing(product);
    setValidation("");
    if (!product) {
      setForm(newProduct());
      return;
    }
    const sample =
      product.status === "draft" && !product.details_confirmed
        ? developmentCatalog.products.find(
            (p) => p.designReference === product.design_reference,
          )
        : undefined;
    setForm({
      design_reference: product.design_reference,
      name: product.name || sample?.name || "",
      description:
        product.description ||
        (sample ? photographDescriptions[product.design_reference] : "") ||
        "",
      price_pence: product.price_pence ?? sample?.pricePence ?? null,
      cost_pence: product.cost_pence,
      status: product.status,
      details_confirmed: product.details_confirmed,
      sort_order: product.sort_order,
      photos: product.photos.length
        ? product.photos
        : collectionPieces.find((p) => p.id === product.design_reference)
            ?.photos || [],
      category: product.category,
      tone:
        product.tone ||
        (sample ? toneByDesign[product.design_reference] : "") ||
        "",
      variants: product.variants.length
        ? product.variants.map((v) => ({
            id: v.id,
            size_label: v.size_label,
            sku: v.sku || "",
            active: v.active,
            on_hand: v.on_hand,
          }))
        : sample
          ? developmentCatalog.lengthsInches.map((size) => ({
              id: undefined,
              size_label: String(size),
              sku: "",
              active: true,
              on_hand: developmentCatalog.stockPerSize,
            }))
          : newProduct().variants,
    });
  };
  useEffect(() => {
    if (createRequest) open();
  }, [createRequest]);
  const deleteProduct = (product: AdminProduct) => {
    if (
      !confirm(
        `Permanently delete ${product.name || product.design_reference}? Its sizes and stock will be removed. Uploaded files stay in your library. Products used by orders or reservations must be archived instead.`,
      )
    )
      return;
    void execute(async () => {
      await adminRequest({
        action: "delete-product",
        id: product.id,
        updatedAt: product.updated_at,
      });
      await refresh();
      setSelected((ids) => ids.filter((id) => id !== product.id));
      if (editing?.id === product.id) {
        setForm(null);
        setEditing(undefined);
      }
    }, "Product deleted. It has been removed from the store; uploaded files remain reusable in your library.");
  };
  const bulk = (
    operation: "stock" | "archive" | "publish" | "hide",
    ids = selected,
  ) =>
    void execute(
      async () => {
        await adminRequest({
          action: "bulk",
          input: {
            operation,
            ids,
            quantity: operation === "stock" ? stock : null,
          },
        });
        await refresh();
        setSelected([]);
      },
      operation === "publish"
        ? `${ids.length} product${ids.length === 1 ? "" : "s"} shown in the collection. Open store tabs update automatically.`
        : operation === "hide"
          ? `${ids.length} product${ids.length === 1 ? "" : "s"} hidden from the collection.`
          : operation === "archive"
            ? "Selected products archived."
            : "Stock quantities updated.",
    );
  const move = (i: number, offset: number) =>
    void execute(async () => {
      const ids = products.map((p) => p.id);
      [ids[i], ids[i + offset]] = [ids[i + offset], ids[i]];
      await adminRequest({
        action: "bulk",
        input: { operation: "reorder", ids, quantity: null },
      });
      await refresh();
    }, "Product order updated.");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setValidation("");
    const candidate = {
      ...form,
      details_confirmed: form.status === "published" || form.details_confirmed,
      ...(editing ? { id: editing.id } : {}),
    };
    const validated = productSchema.safeParse(candidate);
    if (!validated.success) {
      setValidation(validated.error.issues.map((i) => i.message).join(" "));
      return;
    }
    void execute(
      async () => {
        await adminRequest({
          action: "product",
          product: validated.data,
          updatedAt: editing?.updated_at || null,
        });
        await refresh();
        setForm(null);
        setEditing(undefined);
      },
      form.status === "published"
        ? "Product saved. It is visible in the collection now. Open store tabs update automatically."
        : "Product saved as a hidden draft or archive. Choose Visible in store and save to show it to customers.",
    );
  };
  const filteredProducts = products
    .map((p, i) => ({ p, i }))
    .filter(({ p }) =>
      `${p.name} ${p.design_reference}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const matchingIds = filteredProducts.slice(0, 500).map(({ p }) => p.id);
  const matchingSelected = matchingIds.filter((id) =>
    selected.includes(id),
  ).length;
  return (
    <>
      <Panel
        title="The collection"
        description="Select products, then Show in collection to make them visible together. Hide from collection keeps them saved privately. Prices are in pounds (£). Choose homepage pieces in Appearance & motion; the collection keeps its alphabetical sorting."
      >
        <div className="admin-toolbar">
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search pieces…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-primary" onClick={() => open()}>
            <Plus size={15} />
            Add another product
          </button>
        </div>
        <div className="admin-toolbar">
          <label className="admin-select-all">
            <input
              type="checkbox"
              aria-label="Select all matching products"
              disabled={busy || !matchingIds.length}
              checked={
                matchingIds.length > 0 &&
                matchingSelected === matchingIds.length
              }
              ref={(node) => {
                if (node)
                  node.indeterminate =
                    matchingSelected > 0 &&
                    matchingSelected < matchingIds.length;
              }}
              onChange={(e) => setSelected(e.target.checked ? matchingIds : [])}
            />
            Select all matching products ({matchingIds.length})
          </label>
          {selected.length > 0 && (
            <button disabled={busy} onClick={() => setSelected([])}>
              Clear selection
            </button>
          )}
          <Link prefetch={false} href="/collection" target="_blank" rel="noopener noreferrer">
            View collection <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {filteredProducts.length > 500 && (
          <p className="admin-caption">
            Select all includes the first 500 matching products. Refine search
            to work with a smaller group.
          </p>
        )}
        {selected.length > 0 && (
          <div className="admin-toolbar admin-bulk">
            <span>{selected.length} selected</span>
            <button
              className="admin-primary"
              disabled={busy}
              onClick={() => bulk("publish")}
            >
              <Eye size={15} aria-hidden="true" /> Show in collection
            </button>
            <button disabled={busy} onClick={() => bulk("hide")}>
              Hide from collection
            </button>
            <label>
              Stock per size
              <input
                type="number"
                value={stock}
                min={0}
                max={1000000}
                onChange={(e) => setStock(Number(e.target.value))}
              />
            </label>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Replace on-hand stock for every size of the selected products?",
                  )
                )
                  bulk("stock");
              }}
            >
              Set stock
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("Archive selected products?")) bulk("archive");
              }}
            >
              Archive
            </button>
          </div>
        )}
        <div className="admin-product-list">
          {filteredProducts.map(({ p, i }) => (
            <div className="admin-product-row" key={p.id}>
              <input
                type="checkbox"
                aria-label={`Select ${p.name || p.design_reference}`}
                disabled={
                  busy || (!selected.includes(p.id) && selected.length >= 500)
                }
                checked={selected.includes(p.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, p.id]
                      : selected.filter((id) => id !== p.id),
                  )
                }
              />
              <img
                src={
                  p.photos[0]?.src ||
                  collectionPieces.find((v) => v.id === p.design_reference)
                    ?.photos[0]?.src ||
                  "/images/home/hero-poster.webp"
                }
                alt=""
              />
              <div className="admin-product-name">
                <strong>{p.name || "Untitled piece"}</strong>
                <small>
                  {p.design_reference} ·{" "}
                  {p.variants.filter((v) => v.active).length} sizes
                  <span className="admin-product-status-inline">
                    {" "}
                    · {p.status}
                  </span>
                </small>
              </div>
              <span>
                {p.price_pence ? formatGbp(p.price_pence) : "Price pending"}
              </span>
              <Status>
                {p.status === "published"
                  ? "Visible in store"
                  : p.status === "draft"
                    ? "Hidden draft"
                    : "Archived"}
              </Status>
              <div className="admin-actions">
                <button
                  aria-label={`Move ${p.design_reference} up`}
                  disabled={busy || i === 0 || Boolean(search)}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  aria-label={`Move ${p.design_reference} down`}
                  disabled={
                    busy || i === products.length - 1 || Boolean(search)
                  }
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                {p.status === "published" ? (
                  <>
                    <Link prefetch={false}
                      href={`/collection/${p.design_reference}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View product ${p.name || p.design_reference}`}
                    >
                      View
                    </Link>
                    <button
                      disabled={busy}
                      onClick={() => bulk("hide", [p.id])}
                      aria-label={`Hide ${p.name || p.design_reference} from collection`}
                    >
                      Hide
                    </button>
                  </>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => bulk("publish", [p.id])}
                    aria-label={`Show ${p.name || p.design_reference} in collection`}
                  >
                    <Eye size={14} aria-hidden="true" /> Show
                  </button>
                )}
                <button onClick={() => open(p)}>Edit</button>
                {canDelete && (
                  <button
                    className="admin-danger"
                    disabled={busy}
                    onClick={() => deleteProduct(p)}
                    aria-label={`Delete product ${p.name || p.design_reference}`}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!products.length && (
          <Empty text="Add your first piece to begin the collection." />
        )}
      </Panel>
      {form && (
        <Panel
          title={
            editing ? `Edit ${editing.design_reference}` : "Create a piece"
          }
          description="Enter the details below. Choose Visible in store to publish on save, or Hidden draft to keep the product private. Existing temporary sample details should be reviewed before publishing."
        >
          <form onSubmit={submit} className="admin-form-stack">
            <div className="admin-fields">
              <Field label="Design reference">
                <input
                  required
                  pattern="design-[0-9]{2,4}"
                  value={form.design_reference}
                  onChange={(e) =>
                    setForm({ ...form, design_reference: e.target.value })
                  }
                />
              </Field>
              <Field label="Product name">
                <input
                  ref={productNameRef}
                  value={form.name}
                  maxLength={150}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Price (£)">
                <MoneyInput
                  min={0.01}
                  value={form.price_pence}
                  onChange={(price_pence) => setForm({ ...form, price_pence })}
                />
              </Field>
              <Field label="Cost (£, private)">
                <MoneyInput
                  value={form.cost_pence}
                  onChange={(cost_pence) => setForm({ ...form, cost_pence })}
                />
              </Field>
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.payload.slug)}>
                      {String(c.payload.name)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Colour / tone">
                <input
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                />
              </Field>
              <Field label="Store visibility">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as typeof form.status,
                    })
                  }
                >
                  <option value="published">Visible in store</option>
                  <option value="draft">Hidden draft</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={5}
                maxLength={2000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
            <p className="admin-caption">
              {form.status === "published"
                ? "Save & show in store confirms these product details and publishes them. A product needs a name, description, price, photo and an active size. Zero stock is displayed as unavailable."
                : "This product stays hidden from customers until you choose Visible in store and save."}
            </p>
            <h3>Photography</h3>
            <Field label="Upload product photographs">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || !canUpload || form.photos.length >= 12}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void execute(async () => {
                    if (!file.type.startsWith("image/"))
                      throw new Error(
                        "Choose a product photograph, rather than a video.",
                      );
                    const src = await uploadAdminFile(file);
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            photos: [
                              ...current.photos,
                              {
                                src,
                                alt: current.name || "Abaya product photograph",
                                label: "Front view",
                              },
                            ],
                          }
                        : current,
                    );
                  }, "Photograph uploaded and added to this product. Save the product to show it in the store.");
                  e.target.value = "";
                }}
              />
            </Field>
            <p className="admin-caption">
              Upload here without leaving the form, or use Add image to choose
              an existing photograph. The first image is the collection cover.
            </p>
            {form.photos.map((ph, i) => (
              <div className="admin-photo-edit" key={i}>
                <img src={ph.src} alt="" />
                <div>
                  <AssetSelect
                    value={ph.src}
                    type="image"
                    library={library}
                    onChange={(src) =>
                      setForm({
                        ...form,
                        photos: form.photos.map((v, n) =>
                          n === i ? { ...v, src } : v,
                        ),
                      })
                    }
                  />
                  <Field label={`Image ${i + 1} description`}>
                    <input
                      required
                      value={ph.alt}
                      maxLength={300}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          photos: form.photos.map((v, n) =>
                            n === i ? { ...v, alt: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="View label">
                    <input
                      value={ph.label}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          photos: form.photos.map((v, n) =>
                            n === i ? { ...v, label: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="admin-actions">
                  <button
                    type="button"
                    disabled={i === 0}
                    aria-label={`Move image ${i + 1} up`}
                    onClick={() => {
                      const photos = [...form.photos];
                      [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
                      setForm({ ...form, photos });
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() =>
                      setForm({
                        ...form,
                        photos: form.photos.filter((_, n) => n !== i),
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={form.photos.length >= 12}
              onClick={() =>
                setForm({
                  ...form,
                  photos: [
                    ...form.photos,
                    {
                      src: "/images/home/hero-poster.webp",
                      alt: "",
                      label: "Front view",
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              Add image
            </button>
            <h3>Sizes & inventory</h3>
            <p className="admin-caption">
              On-hand includes reserved units. Stock cannot be reduced below a
              current reservation. Uncheck Active to retire a size while
              retaining its history.
            </p>
            {form.variants.map((v, i) => (
              <div className="admin-variant-row" key={i}>
                <Field label="Length / size">
                  <input
                    required
                    value={v.size_label}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        variants: form.variants.map((v, n) =>
                          n === i ? { ...v, size_label: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="SKU">
                  <input
                    value={v.sku}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        variants: form.variants.map((v, n) =>
                          n === i ? { ...v, sku: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="On hand">
                  <input
                    required
                    type="number"
                    min={
                      editing?.variants.find((old) => old.id === v.id)
                        ?.reserved || 0
                    }
                    max={1000000}
                    value={v.on_hand}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        variants: form.variants.map((v, n) =>
                          n === i
                            ? { ...v, on_hand: Number(e.target.value) }
                            : v,
                        ),
                      })
                    }
                  />
                </Field>
                <span className="admin-caption">
                  {editing?.variants.find((old) => old.id === v.id)
                    ?.inventory_known === false && (
                    <span>
                      Stock has not been recorded. Review the starting quantity
                      of zero.
                      <br />
                    </span>
                  )}
                  Reserved:{" "}
                  {editing?.variants.find((old) => old.id === v.id)?.reserved ||
                    0}
                </span>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        variants: form.variants.map((v, n) =>
                          n === i ? { ...v, active: e.target.checked } : v,
                        ),
                      })
                    }
                  />
                  Active
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  variants: [
                    ...form.variants,
                    {
                      id: undefined,
                      size_label: "",
                      sku: "",
                      active: true,
                      on_hand: 0,
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              Add size
            </button>
            {validation && <p role="alert">{validation}</p>}
            <div className="admin-actions">
              <button type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="admin-primary" disabled={busy}>
                {form.status === "published"
                  ? "Save & show in store"
                  : form.status === "draft"
                    ? "Save hidden draft"
                    : "Save archived product"}
              </button>
            </div>
          </form>
        </Panel>
      )}
    </>
  );
}

const entityDefaults = {
  category: { name: "", slug: "", description: "", sort_order: 0 },
  coupon: {
    code: "",
    type: "percent",
    value: 10,
    min_subtotal_pence: 0,
    active: true,
    expires_at: null,
    usage_limit: null,
  },
  expense: {
    title: "",
    amount_pence: 0,
    date: new Date().toISOString().slice(0, 10),
    note: "",
  },
};
function EntityForm({
  kind,
  record,
  onSave,
  busy,
}: {
  kind: "category" | "coupon" | "expense";
  record?: AdminRecord;
  onSave: (d: unknown, r?: AdminRecord) => Promise<void | boolean>;
  busy: boolean;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(
    record?.payload || entityDefaults[kind],
  );
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (record) setForm(record.payload);
  }, [record?.version]);
  const slugFor = (name: string) =>
    name
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
  const labels: Record<string, string> = {
    name: "Name",
    slug: "Slug",
    description: "Description",
    sort_order: "Display order",
    code: "Coupon code",
    type: "Discount type",
    value: form.type === "fixed" ? "Discount (£)" : "Discount (%)",
    min_subtotal_pence: "Minimum subtotal (£)",
    active: "Active",
    expires_at: "Expiry (optional)",
    usage_limit: "Usage limit (optional)",
    title: "Expense title",
    amount_pence: "Amount (£)",
    date: "Date",
    note: "Note",
  };
  const fields = Object.keys(entityDefaults[kind]).filter(key=>!(kind==="coupon" && form.type==="free_delivery" && key==="value"));
  return (
    <details ref={detailsRef} className="admin-panel admin-entity-form">
      <summary>{record ? `Edit ${kind}` : `Add ${kind}`}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(form, record).then((saved) => {
            if (saved === false) return;
            if (!record) setForm({ ...entityDefaults[kind] });
            if (detailsRef.current) detailsRef.current.open = false;
          });
        }}
        className="admin-form-stack"
      >
        <div className="admin-fields">
          {fields.map((key) => (
            <Field key={key} label={labels[key]}>
              {key === "active" ? (
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.checked })
                  }
                />
              ) : ["min_subtotal_pence", "amount_pence"].includes(key) ||
                (key === "value" && form.type === "fixed") ? (
                <MoneyInput
                  required
                  value={form[key] == null ? null : Number(form[key])}
                  onChange={(pence) => setForm({ ...form, [key]: pence ?? 0 })}
                />
              ) : key === "type" ? (
                <select
                  value={String(form[key])}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: e.target.value,
                      value: e.target.value === "fixed" ? 1000 : e.target.value === "free_delivery" ? 0 : 10,
                    })
                  }
                >
                  <option value="percent">Percentage</option>
                  <option value="free_delivery">Free standard delivery</option>
                  <option value="fixed">Fixed amount (£)</option>
                </select>
              ) : key === "description" || key === "note" ? (
                <textarea
                  value={String(form[key] || "")}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <input
                  required={!["expires_at", "usage_limit"].includes(key)}
                  type={
                    key === "expires_at"
                      ? "datetime-local"
                      : key === "date"
                        ? "date"
                        : [
                              "value",
                              "min_subtotal_pence",
                              "usage_limit",
                              "amount_pence",
                              "sort_order",
                            ].includes(key)
                          ? "number"
                          : "text"
                  }
                  min={
                    ["value", "usage_limit"].includes(key)
                      ? 1
                      : key === "sort_order"
                        ? 0
                        : undefined
                  }
                  max={key === "value" ? 100 : undefined}
                  pattern={key === "slug" ? "[a-z0-9-]+" : undefined}
                  value={
                    key === "expires_at" && form[key]
                      ? new Date(
                          new Date(String(form[key])).getTime() -
                            new Date(String(form[key])).getTimezoneOffset() *
                              60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : String(form[key] ?? "")
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ...(key === "name" &&
                      (!form.slug ||
                        form.slug === slugFor(String(form.name || "")))
                        ? { slug: slugFor(e.target.value) }
                        : {}),
                      [key]:
                        key === "expires_at"
                          ? e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null
                          : [
                                "value",
                                "min_subtotal_pence",
                                "usage_limit",
                                "amount_pence",
                                "sort_order",
                              ].includes(key)
                            ? e.target.value
                              ? Number(e.target.value)
                              : key === "usage_limit"
                                ? null
                                : 0
                            : key === "slug"
                              ? e.target.value.toLowerCase().replace(/\s/g, "-")
                              : key === "code"
                                ? e.target.value.toUpperCase()
                                : e.target.value,
                    })
                  }
                />
              )}
            </Field>
          ))}
        </div>
        {kind === "category" && (
          <p className="admin-caption">
            The link name (slug) is filled from the category name. Save to show
            this category in the collection, then assign products in Products &
            stock.
          </p>
        )}
        <button className="admin-primary" disabled={busy}>
          Save {kind}
        </button>
      </form>
    </details>
  );
}
function RecordList({
  records,
  remove,
  save,
  busy,
}: {
  records: AdminRecord[];
  remove: (r: AdminRecord) => void;
  save: (d: unknown, r: AdminRecord) => Promise<void | boolean>;
  busy: boolean;
}) {
  return (
    <Panel title="Saved records">
      {!records.length && <Empty text="No records yet. Add one above." />}
      {records.map((r) => (
        <div key={r.id} className="admin-record">
          <div className="admin-list-row">
            <span>
              <strong>
                {String(r.payload.name || r.payload.code || r.payload.title)}
              </strong>
              <small>
                {String(
                  r.payload.slug || r.payload.date || r.payload.type || "",
                )}
              </small>
            </span>
            {typeof r.payload.amount_pence === "number" && (
              <span>{formatGbp(r.payload.amount_pence)}</span>
            )}
            <button
              disabled={busy}
              onClick={() => remove(r)}
              aria-label={`Delete ${String(r.payload.name || r.payload.code || r.payload.title)}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <EntityForm
            kind={r.kind as "category" | "coupon" | "expense"}
            record={r}
            busy={busy}
            onSave={(d) => save(d, r)}
          />
        </div>
      ))}
    </Panel>
  );
}

function OrderManager({
  records,
  busy,
  save,
  reconcile,
}: {
  records: AdminRecord[];
  busy: boolean;
  save: (d: unknown, r: AdminRecord) => Promise<void | boolean>;
  reconcile: () => Promise<void | boolean>;
}) {
  const [filter, setFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const [search, setSearch] = useState("");
  const list = records.filter(
    (r) =>
      (filter === "all" || r.payload.status === filter) &&
      (paymentFilter === "all" || (paymentFilter === "review" ? r.payload.needs_attention === true : paymentFilter === "pending" ? r.payload.checkout_state === "pending" : r.payload.payment_status === paymentFilter)) &&
      (environment === "all" || (environment === "test") === (r.payload.is_test === true)) &&
      JSON.stringify(r.payload).toLowerCase().includes(search.toLowerCase()),
  );
  function exportOrders() {
    const url = URL.createObjectURL(
      new Blob(
        [orderCsv(list)],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `seen-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Panel
      title="Orders & fulfilment"
      description="Payment state comes from the payment provider. Changing fulfilment status never collects, cancels or refunds money."
    >
      <div className="admin-toolbar">
        <input
          type="search"
          placeholder="Search orders or customers…"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filter}
          aria-label="Filter order status"
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "all",
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "completed",
            "cancelled",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Filter payment status" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}>
          <option value="all">All payments</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="pending">Awaiting confirmation</option><option value="review">Needs review</option><option value="failed">Failed</option><option value="expired">Expired</option>
        </select>
        <select aria-label="Filter order environment" value={environment} onChange={e=>setEnvironment(e.target.value)}><option value="all">All orders</option><option value="customer">Customer orders</option><option value="test">Test orders</option></select>
        <button onClick={exportOrders} disabled={!list.length}>
          Export CSV
        </button>
        <button
          onClick={() => {
            void reconcile();
          }}
          disabled={busy}
        >
          Refresh payment statuses
        </button>
      </div>
      {!list.length && (
        <Empty text="No matching orders. Test checkouts appear here when payment setup is enabled." />
      )}
      {list.map((r) => (
        <details key={r.id} className="admin-record">
          <summary>
            <strong>
              {String(r.payload.order_number || r.id.slice(0, 8))}
            </strong>{" "}
            · {String(r.payload.name || "Customer")} ·{" "}
            {formatGbp(Number(r.payload.total_pence || 0))}{" "}
            <Status>{String(r.payload.status)}</Status>
            <Status>{orderDetails(r).paymentLabel}</Status>
            {r.payload.is_test === true && (
              <Status>Test · Do not dispatch</Status>
            )}
            {r.payload.needs_attention === true && (
              <Status>Payment needs review</Status>
            )}
          </summary>
          <OrderDetails record={r} />
          <OrderForm
            key={`${r.id}:${r.version}`}
            record={r}
            save={save}
            busy={busy}
          />
        </details>
      ))}
    </Panel>
  );
}
function OrderForm({
  record,
  save,
  busy,
}: {
  record: AdminRecord;
  save: (d: unknown, r: AdminRecord) => Promise<void | boolean>;
  busy: boolean;
}) {
  const [status, setStatus] = useState(
    String(record.payload.status || "pending"),
  );
  const [tracking, setTracking] = useState(
    String(record.payload.tracking || ""),
  );
  const [notes, setNotes] = useState(String(record.payload.notes || ""));
  return (
    <form
      className="admin-form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ status, tracking, notes }, record);
      }}
    >
      <Field label="Fulfilment status">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {[
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "completed",
            "cancelled",
          ].map((s) => (
            <option
              key={s}
              disabled={
                (s === "confirmed" && (record.payload.payment_status !== "paid" || record.payload.needs_attention === true)) ||
                (["processing", "shipped", "completed"].includes(s) &&
                  (record.payload.is_test === true ||
                    record.payload.needs_attention === true)) ||
                (s === "cancelled" && record.payload.stock_state === "reserved")
              }
            >
              {s}
            </option>
          ))}
        </select>
      </Field>
      {record.payload.is_test === true && (
        <p className="admin-help">
          Sandbox payment: no real money was charged. Test orders cannot be
          dispatched. Payment completion releases their temporary reservation.
        </p>
      )}
      <Field label="Royal Mail / courier tracking reference">
        <input
          value={tracking}
          maxLength={200}
          onChange={(e) => setTracking(e.target.value)}
        />
      </Field>
      <Field label="Internal notes">
        <textarea
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <button className="admin-primary" disabled={busy}>
        Save fulfilment details
      </button>
    </form>
  );
}
function Inbox({
  records,
  busy,
  save,
  remove,
}: {
  records: AdminRecord[];
  busy: boolean;
  save: (d: unknown, r: AdminRecord) => Promise<void | boolean>;
  remove: (r: AdminRecord) => void;
}) {
  const [filter, setFilter] = useState("active");
  return (
    <Panel
      title="Customer care"
      description="Verified contact submissions appear here when server-side inbox storage is configured. Replies open your email application."
    >
      <div className="admin-toolbar">
        <select
          aria-label="Filter messages"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Active messages</option>
          <option value="unread">Unread</option>
          <option value="archived">Archived</option>
          <option value="all">All messages</option>
        </select>
      </div>
      {!records.length && <Empty text="No customer messages yet." />}
      {records
        .filter((r) =>
          filter === "all" || filter === "archived"
            ? filter === "all" || r.payload.archived
            : filter === "unread"
              ? !r.payload.read && !r.payload.archived
              : !r.payload.archived,
        )
        .map((r) => (
          <details className="admin-record" key={r.id}>
            <summary>
              {!r.payload.read && <Status>Unread</Status>}{" "}
              {String(r.payload.name)} ·{" "}
              {new Date(r.created_at).toLocaleDateString("en-GB")}
            </summary>
            <p>
              {String(r.payload.email)} · {String(r.payload.phone)}
            </p>
            <p className="admin-message-body">{String(r.payload.message)}</p>
            <div className="admin-actions">
              <a href={`mailto:${encodeURIComponent(String(r.payload.email))}`}>
                Reply by email
                <ArrowUpRight size={15} />
              </a>
              <button
                disabled={busy}
                onClick={() =>
                  void save(
                    {
                      read: !r.payload.read,
                      archived: Boolean(r.payload.archived),
                      notes: String(r.payload.notes || ""),
                    },
                    r,
                  )
                }
              >
                {r.payload.read ? "Mark unread" : "Mark read"}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void save(
                    {
                      read: Boolean(r.payload.read),
                      archived: !r.payload.archived,
                      notes: String(r.payload.notes || ""),
                    },
                    r,
                  )
                }
              >
                {r.payload.archived ? "Unarchive" : "Archive"}
              </button>
              <button disabled={busy} onClick={() => remove(r)}>
                Delete
              </button>
            </div>
          </details>
        ))}
    </Panel>
  );
}

function MediaLibrary({
  files,
  busy,
  execute,
  reload,
  onUse,
}: {
  files: LibraryFile[];
  busy: boolean;
  execute: (
    fn: () => Promise<void>,
    message?: string,
  ) => Promise<void | boolean>;
  reload: () => Promise<void | boolean>;
  onUse: (src: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Panel
      title="Your visual library"
      description="Original photography and moving images. Files stay private until a published page or product references them."
    >
      <div className="admin-upload">
        <Upload size={25} strokeWidth={1.2} />
        <div>
          <strong>Upload images & videos from your computer.</strong>
          <p>JPG, PNG, WebP and MP4 · up to 25 MB each</p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4"
          aria-label="Upload media"
          disabled={busy}
          onChange={(e) => {
            const chosen = [...(e.target.files || [])];
            e.target.value = "";
            if (chosen.length)
              void execute(async () => {
                if (chosen.length > 20)
                  throw new Error("Choose up to 20 files at a time.");
                try {
                  for (const file of chosen) await uploadAdminFile(file);
                } finally {
                  await reload();
                }
              }, "File uploaded privately. Use on a page below, or choose it in any compatible image or video selector.");
          }}
        />
      </div>
      <div className="admin-media-grid">
        {files.map((f) => (
          <div key={f.name} className="admin-asset-card">
            {f.name.endsWith(".mp4") ? (
              <video
                src={f.src}
                controls
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img src={f.src} alt="Uploaded library asset" loading="lazy" />
            )}
            <code>{f.displayName || f.name}</code>
            <small>{((f.size || 0) / 1024 / 1024).toFixed(2)} MB</small>
            <div className="admin-actions">
              <button disabled={busy} onClick={() => onUse(f.src)}>
                Use on a page
              </button>
              <button onClick={() => void navigator.clipboard.writeText(f.src)}>
                Copy path
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm("Delete this unused file?"))
                    void execute(async () => {
                      await adminRequest(
                        { action: "delete", name: f.name },
                        "/api/admin/media",
                      );
                      await reload();
                    }, "File deleted.");
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {!files.length && (
        <Empty text="Upload a new image or film to start your library. Existing website assets remain available in image selectors." />
      )}
    </Panel>
  );
}

function PolicyEditor({
  allowedGroups,
  value,
  onChange,
}: {
  value: unknown;
  allowedGroups?: string[];
  onChange: (v: unknown) => void;
}) {
  const parsed = settingsSchema.safeParse(value);
  const current = parsed.success
    ? parsed.data
    : (defaultDocument.policies as ReturnType<typeof settingsSchema.parse>);
  const update = (group: string, key: string, next: unknown) =>
    onChange({
      ...current,
      [group]: { ...current[group as keyof typeof current], [key]: next },
    });
  const booleanFields = ["vatRegistered", "expressAvailable"];
  const numbers = ["standardChargePence", "expressChargePence"];
  return (
    <Panel
      title="Business, delivery & policy details"
      description="Leave unconfirmed information blank. Legal pages remain drafts until required details and review are complete."
    >
      {Object.entries(current).filter(([group]) => !allowedGroups || allowedGroups.includes(group)).map(([group, fields]) => (
        <details className="admin-policy-group" key={group}>
          <summary>{group}</summary>
          <div className="admin-fields">
            {Object.entries(fields).filter(([key]) => key !== "standardChargePence").map(([key, val]) => (
              <Field
                key={key}
                label={
                  numbers.includes(key)
                    ? key === "standardChargePence"
                      ? "Standard delivery charge (£)"
                      : "Express delivery charge (£)"
                    : key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (c) => c.toUpperCase())
                }
              >
                {key === "status" ? (
                  <select
                    value={String(val)}
                    onChange={(e) => update(group, key, e.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                ) : key === "legalForm" ? (
                  <select
                    value={String(val || "")}
                    onChange={(e) => update(group, key, e.target.value || null)}
                  >
                    <option value="">Unconfirmed</option>
                    {[
                      "sole-trader",
                      "limited-company",
                      "partnership",
                      "other",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : booleanFields.includes(key) ? (
                  <select
                    value={val === null ? "" : String(val)}
                    onChange={(e) =>
                      update(
                        group,
                        key,
                        e.target.value === ""
                          ? null
                          : e.target.value === "true",
                      )
                    }
                  >
                    <option value="">Unconfirmed</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : numbers.includes(key) ? (
                  <MoneyInput
                    value={val === null ? null : Number(val)}
                    onChange={(pence) => update(group, key, pence)}
                  />
                ) : (
                  <input
                    type={key === "reviewedOn" ? "date" : "text"}
                    value={String(val ?? "")}
                    onChange={(e) =>
                      update(
                        group,
                        key,
                        e.target.value
                          ? numbers.includes(key)
                            ? Number(e.target.value)
                            : e.target.value
                          : null,
                      )
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        </details>
      ))}
    </Panel>
  );
}
function MotionDemo({
  appearance,
}: {
  appearance: SiteDocument["appearance"];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cleanup: () => void = () => {};
    let cancelled = false;
    void import("gsap").then(({ gsap }) => {
      if (cancelled) return;
      const enter = (e: PointerEvent) => {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x:
            appearance.hover === "magnetic"
              ? (e.clientX - r.left - r.width / 2) * 0.15
              : 0,
          y: appearance.hover === "lift" ? -4 : 0,
          filter:
            appearance.hover === "sheen" ? "brightness(1.25)" : "brightness(1)",
          duration: 0.5,
          ease: "power3.out",
          overwrite: true,
        });
      };
      const leave = () => {
        gsap.to(el, {
          x: 0,
          y: 0,
          filter: "brightness(1)",
          duration: 0.6,
          overwrite: true,
        });
      };
      el.addEventListener("pointermove", enter);
      el.addEventListener("pointerleave", leave);
      cleanup = () => {
        el.removeEventListener("pointermove", enter);
        el.removeEventListener("pointerleave", leave);
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: "transform,filter" });
      };
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [appearance]);
  return (
    <div className="admin-motion-demo">
      <p>Hover to feel the selected effect</p>
      <button ref={ref} type="button" className="admin-primary">
        Discover the collection
        <ArrowUpRight size={17} />
      </button>
    </div>
  );
}
function SecuritySettings({
  email,
  role,
  busy,
  execute,
}: {
  email: string;
  role: string;
  busy: boolean;
  execute: (
    fn: () => Promise<void>,
    message?: string,
  ) => Promise<void | boolean>;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <Panel
      title="Change your password"
      description="Manage your sign-in details. Only approved administrators can access this workspace."
    >
      <p>
        {email} · {role}
      </p>
      <form
        className="admin-form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void execute(async () => {
            if (password !== confirmation)
              throw new Error("The new passwords do not match.");
            await adminRequest(
              {
                action: "password",
                current,
                password,
              },
              "/api/admin/auth",
            );
            window.location.assign("/admin/login");
          });
        }}
      >
        <Field label="Current password">
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field label="New password (at least 14 characters)">
          <input
            type="password"
            autoComplete="new-password"
            minLength={14}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            minLength={14}
            maxLength={128}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        </Field>

        <button className="admin-primary" disabled={busy}>
          Change password & sign out all sessions
        </button>
      </form>
      <p className="admin-caption">Forgot your password? Use the reset link on the sign-in page. Add and verify your recovery email before you need it.</p>
    </Panel>
  );
}