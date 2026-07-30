import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
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
  Copy,
  GripVertical,
  Hash,
  List,
  MessageSquareText,
  MousePointer2,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  Type
} from "lucide-react";

type FieldType = "shortText" | "longText" | "number" | "select" | "checkbox";

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
};

const fieldCatalog: Array<{
  type: FieldType;
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

const starterFields: FormField[] = [
  {
    id: crypto.randomUUID(),
    type: "shortText",
    label: "What should we call you?",
    placeholder: "Enter your name",
    required: true
  },
  {
    id: crypto.randomUUID(),
    type: "longText",
    label: "Tell us what you think",
    placeholder: "Share your experience...",
    required: false
  }
];

function makeField(type: FieldType): FormField {
  const catalogItem = fieldCatalog.find((item) => item.type === type)!;
  return {
    id: crypto.randomUUID(),
    type,
    label: catalogItem.label,
    placeholder: type === "checkbox" ? "" : `Enter ${catalogItem.label.toLowerCase()}`,
    required: false
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
      <div className="field-preview">
        <label>
          {field.label}
          {field.required && <span className="required-mark"> *</span>}
        </label>
        {field.type === "longText" ? (
          <textarea disabled placeholder={field.placeholder} rows={3} />
        ) : field.type === "select" ? (
          <select disabled defaultValue="">
            <option value="">{field.placeholder || "Choose an option"}</option>
          </select>
        ) : field.type === "checkbox" ? (
          <span className="checkbox-preview">
            <input disabled type="checkbox" /> Yes, I agree
          </span>
        ) : (
          <input disabled type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder} />
        )}
      </div>
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
  fields,
  selectedId,
  onSelect,
  onRemove
}: {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "form-canvas" });

  return (
    <div className={`form-canvas${isOver ? " drop-active" : ""}`} ref={setNodeRef}>
      <div className="form-intro">
        <span className="form-kicker">Customer research</span>
        <h2>Help us build something better</h2>
        <p>Your answers shape what we make next. This should only take two minutes.</p>
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
          <span>Drag from the field library or click a field.</span>
        </div>
      )}

      <button className="submit-preview" type="button">
        Submit response
      </button>
    </div>
  );
}

export function BuilderPage({
  onBack,
  formTitle
}: {
  onBack: () => void;
  formTitle: string;
}) {
  const [fields, setFields] = useState<FormField[]>(starterFields);
  const [selectedId, setSelectedId] = useState<string | null>(starterFields[0]?.id ?? null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedId) ?? null,
    [fields, selectedId]
  );

  function addField(type: FieldType) {
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

  function handleDragEnd(event: DragEndEvent) {
    setActiveLabel(null);
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.source === "palette") {
      addField(active.data.current.type as FieldType);
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        const type = active.data.current?.type as FieldType | undefined;
        setActiveLabel(type ? fieldCatalog.find((item) => item.type === type)?.label ?? null : "Move field");
      }}
      onDragCancel={() => setActiveLabel(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="builder-page">
        <header className="builder-header">
          <div className="builder-title">
            <button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">
              <ChevronLeft size={19} />
            </button>
            <div>
              <input aria-label="Form title" defaultValue={formTitle} />
              <span>
                Draft <i /> All changes saved locally
              </span>
            </div>
          </div>
          <div className="builder-actions">
            <button className="secondary-button" type="button">
              <Save size={17} /> Save draft
            </button>
            <button className="primary-button" type="button">
              <Send size={17} /> Publish
            </button>
          </div>
        </header>

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
              <span>Desktop preview</span>
              <span>{fields.length} fields</span>
            </div>
            <Canvas
              fields={fields}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={(id) => {
                setFields((current) => current.filter((field) => field.id !== id));
                if (selectedId === id) setSelectedId(null);
              }}
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
                    value={selectedField.label}
                    onChange={(event) => updateSelected({ label: event.target.value })}
                  />
                </label>
                {selectedField.type !== "checkbox" && (
                  <label>
                    Placeholder
                    <input
                      value={selectedField.placeholder}
                      onChange={(event) => updateSelected({ placeholder: event.target.value })}
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
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    setFields((current) => current.filter((field) => field.id !== selectedField.id));
                    setSelectedId(null);
                  }}
                >
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
