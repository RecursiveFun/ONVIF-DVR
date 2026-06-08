export default function DragHandle({ onDragStart, onDragEnd, label = 'Drag beside the page' }) {
  return (
    <span
      className="drag-handle"
      draggable
      onDragStart={(e) => {
        onDragStart(e);
        e.stopPropagation();
      }}
      onDragEnd={(e) => {
        onDragEnd?.(e);
        e.stopPropagation();
      }}
      title={label}
      aria-label={label}
    >
      ⠿
    </span>
  );
}
