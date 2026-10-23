"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Film, ImageIcon, Upload, X } from "lucide-react";
import { collectionPieces } from "@/data/collection";
import { uploadAdminFile, type LibraryFile } from "@/lib/admin/client";

type Kind = "image" | "video" | "any";
type Selection = { kind: Kind; onSelect: (src: string) => void };
const Context = createContext<{
  browse: (selection: Selection) => void;
} | null>(null);
export function useMediaPicker() {
  const picker = useContext(Context);
  if (!picker)
    throw new Error("Media selection requires the admin media provider.");
  return picker;
}
export function AdminMediaProvider({
  files,
  canManage = true,
  reload,
  children,
}: {
  files: LibraryFile[];
  canManage?: boolean;
  reload: () => Promise<unknown>;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Kind>("any");
  const [limit, setLimit] = useState(40);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState<LibraryFile[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const browse = (next: Selection) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setQuery("");
    setFilter(next.kind);
    setLimit(40);
    setError("");
    setStatus("");
    setSelection(next);
    void reload().catch(() =>
      setError("Could not reload uploaded files. Try reopening the library."),
    );
  };
  useEffect(() => {
    if (!selection) return;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      returnFocus.current?.focus();
    };
  }, [selection]);
  const originals = [
    { src: "/videos/home/hero.mp4", label: "Original campaign film" },
    { src: "/images/home/hero-poster.webp", label: "Original campaign poster" },
    { src: "/images/brand/seen-signature.svg", label: "SEEN signature logo" },
    { src: "/images/brand/logo.webp", label: "SEEN original logo" },
    ...collectionPieces.flatMap((p) =>
      p.photos.map((ph) => ({
        src: ph.src,
        label: `${p.visualLabel} — ${ph.label}`,
      })),
    ),
  ];
  const assets = [
    ...new Map([
      ...files.map(
        (f) => [f.src, { src: f.src, label: f.displayName || f.name }] as const,
      ),
      ...originals.map((f) => [f.src, f] as const),
      ...added.map(
        (f) => [f.src, { src: f.src, label: f.displayName || f.name }] as const,
      ),
    ]).values(),
  ].filter((f) => {
    const kind = f.src.endsWith(".mp4") ? "video" : "image";
    return (
      (selection?.kind === "any" || selection?.kind === kind) &&
      (filter === "any" || filter === kind) &&
      `${f.label} ${f.src}`.toLowerCase().includes(query.toLowerCase())
    );
  });
  const choose = (src: string) => {
    selection?.onSelect(src);
    setSelection(null);
  };
  return (
    <Context value={{ browse }}>
      {children}
      {selection &&
        createPortal(
          <dialog
            className="admin-workspace admin-media-dialog"
            ref={dialog}
            aria-labelledby="media-picker-title"
            onCancel={(e) => {
              e.preventDefault();
              if (!busy) setSelection(null);
            }}
          >
            <div className="admin-media-dialog__header">
              <div>
                <p className="admin-eyebrow">Your reusable library</p>
                <h2 id="media-picker-title">
                  Choose{" "}
                  {selection.kind === "any"
                    ? "an image or video"
                    : `an ${selection.kind === "image" ? "image" : "MP4 video"}`}
                </h2>
              </div>
              <button
                disabled={busy}
                onClick={() => setSelection(null)}
                aria-label="Close media library"
              >
                <X size={20} />
              </button>
            </div>
            <p>
              Upload from your computer, then use the same file in any
              compatible website slot. JPG, PNG, WebP or MP4 · 25 MB per file.
            </p>
            <label className="admin-upload-button" hidden={!canManage}>
              <Upload size={17} />
              <span>{busy ? status : "Upload from computer"}</span>
              <input
                type="file"
                multiple
                disabled={busy || !canManage}
                aria-label="Upload from computer"
                accept={
                  selection.kind === "image"
                    ? "image/jpeg,image/png,image/webp"
                    : selection.kind === "video"
                      ? "video/mp4"
                      : "image/jpeg,image/png,image/webp,video/mp4"
                }
                onChange={async (e) => {
                  const chosen = [...(e.target.files || [])];
                  e.target.value = "";
                  if (!chosen.length) return;
                  if (chosen.length > 20) {
                    setError("Choose up to 20 files at a time.");
                    return;
                  }
                  setBusy(true);
                  setError("");
                  let last = "";
                  try {
                    for (let index = 0; index < chosen.length; index++) {
                      const file = chosen[index];
                      if (
                        (selection.kind === "image" &&
                          !file.type.startsWith("image/")) ||
                        (selection.kind === "video" &&
                          file.type !== "video/mp4")
                      )
                        throw new Error(
                          "Choose a file matching this image/video slot.",
                        );
                      setStatus(`Uploading ${index + 1} of ${chosen.length}…`);
                      last = await uploadAdminFile(file);
                      setAdded((items) => [
                        {
                          name: last.split("/").pop()!,
                          src: last,
                          size: file.size,
                          created_at: new Date().toISOString(),
                          displayName: file.name,
                        },
                        ...items,
                      ]);
                    }
                    await reload();
                    setQuery("");
                    setStatus(
                      "Upload complete. Select a file below to use it.",
                    );
                    if (chosen.length === 1) choose(last);
                  } catch (err) {
                    setStatus(
                      "Upload stopped. Successfully uploaded files remain in your library.",
                    );
                    setError(
                      err instanceof Error ? err.message : "Upload failed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <div role="status" aria-live="polite">
              {status}
            </div>
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-toolbar">
              <input
                type="search"
                aria-label="Search media library"
                placeholder="Search files…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(40);
                }}
              />
              {selection.kind === "any" && (
                <select
                  aria-label="Media type"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Kind)}
                >
                  <option value="any">Images & videos</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                </select>
              )}
            </div>
            <div className="admin-picker-grid">
              {assets.slice(0, limit).map((f) => (
                <button
                  type="button"
                  className="admin-picker-card"
                  disabled={busy}
                  key={f.src}
                  onClick={() => choose(f.src)}
                  aria-label={`Use ${f.label}`}
                >
                  {f.src.endsWith(".mp4") ? (
                    <span className="admin-picker-video">
                      <Film size={32} />
                      <span>MP4 video</span>
                    </span>
                  ) : (
                    <img src={f.src} alt="" loading="lazy" />
                  )}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
            {!assets.length && <p>No matching files. Upload one above.</p>}
            {assets.length > limit && (
              <button onClick={() => setLimit((n) => n + 40)}>
                Show more files
              </button>
            )}
          </dialog>,
          document.body,
        )}
    </Context>
  );
}
export function MediaChoiceButton({
  value,
  kind,
  onChange,
  label,
}: {
  value?: string;
  kind: Kind;
  onChange: (src: string) => void;
  label?: string;
}) {
  const { browse } = useMediaPicker();
  return (
    <button type="button" onClick={() => browse({ kind, onSelect: onChange })}>
      {kind === "video" ? <Film size={15} /> : <ImageIcon size={15} />}{" "}
      {label ||
        `Browse ${kind === "any" ? "images & videos" : kind === "image" ? "images" : "videos"}`}
      {value && (
        <span className="sr-only">
          {" "}
          — current file {value.split("/").pop()}
        </span>
      )}
    </button>
  );
}
