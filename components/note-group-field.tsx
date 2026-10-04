import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UNGROUPED = "未分組";

export function NoteGroupField({
  groups,
  selected,
  custom,
  onSelected,
  onCustom,
  groupLabel = "分組",
  newGroupLabel = "新分組名稱",
  ungroupedLabel = UNGROUPED,
}: {
  groups: string[];
  selected: string;
  custom: string;
  onSelected: (value: string) => void;
  onCustom: (value: string) => void;
  groupLabel?: string;
  newGroupLabel?: string;
  ungroupedLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-group">{groupLabel}</Label>
        <select
          id="note-group"
          value={selected}
          onChange={(event) => onSelected(event.target.value)}
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-base md:text-sm"
        >
          <option value="">{ungroupedLabel}</option>
          {groups.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-group-name">{newGroupLabel}</Label>
        <Input
          id="note-group-name"
          value={custom}
          onChange={(event) => onCustom(event.target.value)}
          className="h-11 text-base md:text-sm"
          maxLength={80}
          placeholder="輸入新分組，會蓋過上面的選擇"
        />
      </div>
    </div>
  );
}

export function chosenNoteGroup(selected: string, custom: string) {
  const typed = custom.trim();
  if (typed && typed !== UNGROUPED) return typed;
  if (!selected || selected === UNGROUPED) return null;
  return selected;
}
