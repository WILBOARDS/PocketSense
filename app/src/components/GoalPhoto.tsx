import { useRef, useState, type CSSProperties } from 'react';
import { useUi } from '../ui';
import { ImagePlus } from './icons';

/**
 * The goal photo, always printed in black and white. A pale cover shrinks from the
 * top as the goal fills, so the photo "develops" with each dollar saved.
 */
export function GoalPhoto({ pct, placeholder, editable, style }: {
  pct: number; placeholder: string; editable?: boolean; style?: CSSProperties;
}) {
  const { photo, setPhoto } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith('image/')) setPhoto(f);
  };

  return (
    <div
      className={'photo' + (dragging ? ' dragging' : '')}
      style={style}
      onDragOver={editable ? e => { e.preventDefault(); setDragging(true); } : undefined}
      onDragLeave={editable ? () => setDragging(false) : undefined}
      onDrop={editable ? e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); } : undefined}
    >
      {photo
        ? <div className="grayscale" style={{ position: 'absolute', inset: 0 }}><img src={photo} alt="" /></div>
        : <div className="photo-empty">{editable && <ImagePlus />}<span>{placeholder}</span></div>}
      {photo && <div className="photo-cover" style={{ height: `${100 - pct}%` }} />}
      {editable && (
        <>
          <button className="photo-btn" onClick={() => input.current?.click()} aria-label={photo ? 'Change goal photo' : 'Add goal photo'} />
          <input ref={input} className="sr-only" type="file" accept="image/*" tabIndex={-1}
            onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        </>
      )}
    </div>
  );
}
