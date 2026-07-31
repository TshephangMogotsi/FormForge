import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckSquare,
  ChevronLeft,
  ClipboardCheck,
  Copy,
  Eye,
  ExternalLink,
  GripVertical,
  Hash,
  List,
  LoaderCircle,
  MessageSquareText,
  MousePointer2,
  Pencil,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  Type
} from "lucide-react";
import {
  api,
  type FormField,
  type FormFieldType,
  type FormSummary
} from "../../lib/api";

type SaveState = "saved" | "unsaved" | "saving" | "error";

type Draft = {
  title: string;
  description: string;
  fields: FormField[];
};

const fieldCatalog: Array<{
  type: FormFieldType;
  label: string;
  description: string;
  icon: typeof Type;
}> = [
  { type: "shortText", label: "Short text", description: "Names and brief answers", icon: Type },
  {
    type: "longText",
    label: "Long text",
    description: "Detailed written responses",
    icon: MessageSquareText
  },
  { type: "number", label: "Number", description: "Numeric values", icon: Hash },
  { type: "select", label: "Dropdown", description: "Choose one option", icon: List },
  { type: "checkbox", label: "Checkbox", description: "Confirmation or consent", icon: CheckSquare }
];

function makeField(type: FormFieldType): FormField {
  const catalogItem = fieldCatalog.find((item) => item.type === type)!;
  return {
    id: crypto.randomUUID(),
    type,
    label: catalogItem.label,
    description: "",
    placeholder: type === "checkbox" ? "" : `Enter ${catalogItem.label.toLowerCase()}`,
    required: false,
    options: type === "select" ? ["Option 1", "Option 2"] : []
  };
}

function PaletteItem({ item }: { item: (typeof fieldCatalog)[number] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { source: "palette", type: item.type }
  });
  const Icon = item.icon;

  return (
    <button
      className={`palette-item${isDragging ? " dragging" : ""}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      type="button"
      {...listeners}
      {...attributes}
    >
      <span className="field-type-icon">
        <Icon size={17} />
      </span>
      <span>
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
      <Plus className="palette-plus" size={16} />
    </button>
  );
}

function FieldControl({
  field,
  disabled,
  inputId,
  describedBy
}: {
  field: FormField;
  disabled: boolean;
  inputId: string;
  describedBy?: string;
}) {
  if (field.type === "longText") {
    return (
      <textarea
        id={inputId}
        aria-describedby={describedBy}
        disabled={disabled}
        placeholder={field.placeholder}
        required={field.required}
        rows={3}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={inputId}
        aria-describedby={describedBy}
        disabled={disabled}
        defaultValue=""
        required={field.required}
      >
        <option value="" disabled>
          {field.placeholder || "Choose an option"}
        </option>
        {field.options.map((option, index) => (
          <option key={`${option}-${index}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <span className="checkbox-preview">
        <input
          id={inputId}
          aria-describedby={describedBy}
          disabled={disabled}
          type="checkbox"
          required={field.required}
        />{" "}
        Yes, I agree
      </span>
    );
  }

  return (
    <input
      id={inputId}
      aria-describedby={describedBy}
      disabled={disabled}
      type={field.type === "number" ? "number" : "text"}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}

function FieldPreview({ field, disabled = true }: { field: FormField; disabled?: boolean }) {
  const inputId = `field-${field.id}`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;

  return (
    <div className="field-preview">
      <label htmlFor={inputId}>
        {field.label}
        {field.required && <span className="required-mark"> *</span>}
      </label>
      {field.description && (
        <small className="field-description" id={descriptionId}>
          {field.description}
        </small>
      )}
      <FieldControl
        field={field}
        disabled={disabled}
        inputId={inputId}
        describedBy={descriptionId}
      />
    </div>
  );
}

function SortableField({
  field,
  selected,
  onSelect,
  onRemove
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { source: "canvas" }
  });

  return (
    <article
      className={`canvas-field${selected ? " selected" : ""}${isDragging ? " dragging" : ""}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
    >
      <button
        className="drag-handle"
        type="button"
        aria-label={`Reorder ${field.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <FieldPreview field={field} />
      <button
        className="icon-button field-delete"
        type="button"
        aria-label={`Delete ${field.label}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
}

function Canvas({
  title,
  description,
  fields,
  selectedId,
  onDescriptionChange,
  onSelect,
  onRemove
}: {
  title: string;
  description: string;
  fields: FormField[];
  selectedId: string | null;
  onDescriptionChange: (description: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "form-canvas" });

  return (
    <div className={`form-canvas${isOver ? " drop-active" : ""}`} ref={setNodeRef}>
      <div className="form-intro">
        <span className="form-kicker">Form preview</span>
        <h2>{title || "Untitled form"}</h2>
        <textarea
          className="form-description-editor"
          aria-label="Form description"
          maxLength={500}
          placeholder="Add a short description for respondents…"
          rows={2}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </div>

      <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
        <div className="canvas-field-list">
          {fields.map((field) => (
            <SortableField
              field={field}
              key={field.id}
              selected={selectedId === field.id}
              onSelect={() => onSelect(field.id)}
              onRemove={() => onRemove(field.id)}
            />
          ))}
        </div>
      </SortableContext>

      {fields.length === 0 && (
        <div className="canvas-empty">
          <MousePointer2 size={22} />
          <strong>Drop your first field here</strong>
          <span>Drag from the field library or double-click a field.</span>
        </div>
      )}

      <button className="submit-preview" type="button">
        Submit response
      </button>
    </div>
  );
}

function FormPreview({ draft }: { draft: Draft }) {
  return (
    <section className="preview-stage" aria-label="Interactive form preview">
      <form
        className="form-canvas preview-canvas"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="form-intro">
          <span className="form-kicker">Preview mode</span>
          <h2>{draft.title || "Untitled form"}</h2>
          <p>{draft.description || "This form does not have a description yet."}</p>
        </div>
        <div className="preview-field-list">
          {draft.fields.map((field) => (
            <FieldPreview disabled={false} field={field} key={field.id} />
          ))}
        </div>
        {draft.fields.length === 0 && <p className="preview-empty">Add fields to preview the form.</p>}
        <button className="submit-preview" type="submit">
          Submit response
        </button>
      </form>
    </section>
  );
}

function saveStateLabel(saveState: SaveState) {
  if (saveState === "saving") return "Saving changes…";
  if (saveState === "unsaved") return "Changes waiting to save";
  if (saveState === "error") return "Save failed — retry";
  return "All changes saved";
}

export function BuilderPage({
  formId,
  onBack,
  onSaved
}: {
  formId: string;
  onBack: () => void;
  onSaved: (form: FormSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const lastSavedSnapshot = useRef("");
  const currentSnapshot = useRef("");
  const saveSequence = useRef(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedId) ?? null,
    [fields, selectedId]
  );
  const draft = useMemo(() => ({ title, description, fields }), [title, description, fields]);
  const draftSnapshot = useMemo(() => JSON.stringify(draft), [draft]);
  currentSnapshot.current = draftSnapshot;

  useEffect(() => {
    let ignore = false;
    setLoaded(false);
    setLoadError(null);

    api
      .getForm(formId)
      .then((form) => {
        if (ignore) return;
        const loadedDraft: Draft = {
          title: form.title,
          description: form.description,
          fields: form.fields ?? []
        };
        setTitle(loadedDraft.title);
        setDescription(loadedDraft.description);
        setFields(loadedDraft.fields);
        setSelectedId(loadedDraft.fields[0]?.id ?? null);
        setPublishedVersion(form.publishedVersion);
        setPublishedUrl(form.slug ? `${window.location.origin}/f/${form.slug}` : null);
        lastSavedSnapshot.current = JSON.stringify(loadedDraft);
        setSaveState("saved");
        setLoaded(true);
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error instanceof Error ? error.message : "The form could not be loaded.");
      });

    return () => {
      ignore = true;
    };
  }, [formId]);

  const saveDraft = useCallback(
    async (snapshot = currentSnapshot.current) => {
      const payload = JSON.parse(snapshot) as Draft;
      if (!payload.title.trim()) {
        setSaveState("error");
        setSaveError("Add a form title before saving.");
        return false;
      }

      const sequence = ++saveSequence.current;
      setSaveState("saving");
      setSaveError(null);
      try {
        const form = await api.updateForm(formId, payload);
        lastSavedSnapshot.current = snapshot;
        onSavedRef.current(form);
        if (sequence === saveSequence.current) {
          setSaveState(currentSnapshot.current === snapshot ? "saved" : "unsaved");
        }
        return true;
      } catch (error) {
        if (sequence === saveSequence.current) {
          setSaveState("error");
          setSaveError(error instanceof Error ? error.message : "Changes could not be saved.");
        }
        return false;
      }
    },
    [formId]
  );

  useEffect(() => {
    if (!loaded || draftSnapshot === lastSavedSnapshot.current) return;
    setSaveState("unsaved");
    const timeout = window.setTimeout(() => void saveDraft(draftSnapshot), 700);
    return () => window.clearTimeout(timeout);
  }, [draftSnapshot, loaded, saveDraft]);

  function addField(type: FormFieldType) {
    if (fields.length >= 50) {
      setSaveError("A form can contain up to 50 fields.");
      return;
    }
    const field = makeField(type);
    setFields((current) => [...current, field]);
    setSelectedId(field.id);
  }

  function updateSelected(patch: Partial<FormField>) {
    if (!selectedId) return;
    setFields((current) =>
      current.map((field) => (field.id === selectedId ? { ...field, ...patch } : field))
    );
  }

  function removeField(id: string) {
    setFields((current) => current.filter((field) => field.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLabel(null);
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.source === "palette") {
      addField(active.data.current.type as FormFieldType);
      return;
    }

    if (active.id !== over.id) {
      setFields((current) => {
        const oldIndex = current.findIndex((field) => field.id === active.id);
        const newIndex = current.findIndex((field) => field.id === over.id);
        return oldIndex >= 0 && newIndex >= 0 ? arrayMove(current, oldIndex, newIndex) : current;
      });
    }
  }

  async function handleBack() {
    if (loaded && currentSnapshot.current !== lastSavedSnapshot.current) {
      const saved = await saveDraft();
      if (!saved) return;
    }
    onBack();
  }

  async function handlePublish() {
    if (publishing) return;
    if (currentSnapshot.current !== lastSavedSnapshot.current) {
      const saved = await saveDraft();
      if (!saved) return;
    }

    setPublishing(true);
    setSaveError(null);
    try {
      const result = await api.publishForm(formId);
      onSavedRef.current(result.form);
      setPublishedVersion(result.publication.version);
      setPublishedUrl(`${window.location.origin}/f/${result.publication.slug}`);
      setLinkCopied(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The form could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishedUrl() {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setLinkCopied(true);
    } catch {
      setSaveError("Copying failed. Open the form and copy its address from the browser.");
    }
  }

  if (loadError) {
    return (
      <div className="builder-feedback" role="alert">
        <strong>We couldn’t open this form.</strong>
        <span>{loadError}</span>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="builder-feedback" aria-live="polite">
        <LoaderCircle className="spin" size={22} />
        <span>Loading the builder…</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        const type = active.data.current?.type as FormFieldType | undefined;
        setActiveLabel(type ? fieldCatalog.find((item) => item.type === type)?.label ?? null : "Move field");
      }}
      onDragCancel={() => setActiveLabel(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="builder-page">
        <header className="builder-header">
          <div className="builder-title">
            <button className="icon-button" type="button" onClick={() => void handleBack()} aria-label="Back to dashboard">
              <ChevronLeft size={19} />
            </button>
            <div>
              <input
                aria-label="Form title"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <span className={`save-state ${saveState}`} aria-live="polite">
                {publishedVersion ? `Published v${publishedVersion}` : "Draft"} <i /> {saveStateLabel(saveState)}
              </span>
            </div>
          </div>
          <div className="builder-actions">
            <button className="secondary-button" type="button" onClick={() => setPreviewing((current) => !current)}>
              {previewing ? <Pencil size={17} /> : <Eye size={17} />}
              {previewing ? "Edit" : "Preview"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={saveState === "saving"}
              onClick={() => void saveDraft()}
            >
              {saveState === "saving" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
              Save draft
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={publishing || fields.length === 0}
              title={fields.length === 0 ? "Add at least one field before publishing" : undefined}
              onClick={() => void handlePublish()}
            >
              {publishing ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
              {publishing ? "Publishing…" : publishedVersion ? "Publish update" : "Publish"}
            </button>
          </div>
        </header>

        {saveError && (
          <button className="builder-save-error" type="button" onClick={() => void saveDraft()}>
            {saveError} Select to retry.
          </button>
        )}

        {publishedUrl && !saveError && (
          <div className="builder-publish-notice" role="status">
            <span>
              <strong>Form is live</strong>
              <small>{publishedUrl}</small>
            </span>
            <button className="icon-button" type="button" onClick={() => void copyPublishedUrl()} aria-label="Copy public form link">
              {linkCopied ? <ClipboardCheck size={17} /> : <Copy size={17} />}
            </button>
            <a className="icon-button" href={publishedUrl} target="_blank" rel="noreferrer" aria-label="Open public form">
              <ExternalLink size={17} />
            </a>
          </div>
        )}

        {previewing ? (
          <FormPreview draft={draft} />
        ) : (
          <div className="builder-workspace">
            <aside className="builder-panel field-library">
              <div className="panel-heading">
                <span>
                  <Plus size={17} /> Fields
                </span>
                <small>Drag into your form</small>
              </div>
              <div className="palette-list">
                {fieldCatalog.map((item) => (
                  <div key={item.type} onDoubleClick={() => addField(item.type)}>
                    <PaletteItem item={item} />
                  </div>
                ))}
              </div>
              <div className="builder-tip">
                <SparklesIcon />
                <span>
                  <strong>Builder tip</strong>
                  Double-click any field to add it instantly.
                </span>
              </div>
            </aside>

            <section className="canvas-stage" aria-label="Form canvas">
              <div className="canvas-toolbar">
                <span>Desktop builder</span>
                <span>{fields.length} fields</span>
              </div>
              <Canvas
                title={title}
                description={description}
                fields={fields}
                selectedId={selectedId}
                onDescriptionChange={setDescription}
                onSelect={setSelectedId}
                onRemove={removeField}
              />
            </section>

            <aside className="builder-panel properties-panel">
              <div className="panel-heading">
                <span>
                  <Settings2 size={17} /> Properties
                </span>
                <small>Configure the selected field</small>
              </div>
              {selectedField ? (
                <div className="property-form">
                  <label>
                    Field label
                    <input
                      maxLength={120}
                      value={selectedField.label}
                      onChange={(event) => updateSelected({ label: event.target.value })}
                    />
                  </label>
                  <label>
                    Help text
                    <input
                      maxLength={240}
                      placeholder="Optional guidance for respondents"
                      value={selectedField.description}
                      onChange={(event) => updateSelected({ description: event.target.value })}
                    />
                  </label>
                  {selectedField.type !== "checkbox" && (
                    <label>
                      Placeholder
                      <input
                        maxLength={120}
                        value={selectedField.placeholder}
                        onChange={(event) => updateSelected({ placeholder: event.target.value })}
                      />
                    </label>
                  )}
                  {selectedField.type === "select" && (
                    <label>
                      Options (one per line)
                      <textarea
                        rows={5}
                        value={selectedField.options.join("\n")}
                        onChange={(event) =>
                          updateSelected({
                            options: event.target.value
                              .split("\n")
                              .map((option) => option.trim())
                              .filter(Boolean)
                              .slice(0, 20)
                          })
                        }
                      />
                    </label>
                  )}
                  <label className="toggle-row">
                    <span>
                      <strong>Required field</strong>
                      <small>People must answer before submitting</small>
                    </span>
                    <input
                      checked={selectedField.required}
                      type="checkbox"
                      onChange={(event) => updateSelected({ required: event.target.checked })}
                    />
                  </label>
                  <div className="field-meta">
                    <span>Field type</span>
                    <strong>{fieldCatalog.find((item) => item.type === selectedField.type)?.label}</strong>
                  </div>
                  <button className="danger-button" type="button" onClick={() => removeField(selectedField.id)}>
                    <Trash2 size={16} /> Delete field
                  </button>
                </div>
              ) : (
                <div className="properties-empty">
                  <MousePointer2 size={22} />
                  <strong>Select a field</strong>
                  <span>Its settings will appear here.</span>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
      <DragOverlay>
        {activeLabel ? (
          <div className="drag-overlay">
            <Copy size={16} /> {activeLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SparklesIcon() {
  return <span className="tip-icon">✦</span>;
}
