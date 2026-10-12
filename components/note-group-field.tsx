import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UNGROUPED = "未分組";

export function NoteGroupField({
  groups,
  selected,
  custom,
  onSelected,
  onCustom,
  idPrefix = "note",
  groupLabel = "分組",
  newGroupLabel = "新分組名稱",
  ungroupedLabel = UNGROUPED,
  placeholder = "輸入新分組，會蓋過上面的選擇",
}: {
  groups: string[];
  selected: string;
  custom: string;
  onSelected: (value: string) => void;
  onCustom: (value: string) => void;
  idPrefix?: string;
  groupLabel?: string;
  newGroupLabel?: string;
  ungroupedLabel?: string;
  placeholder?: string;
}) {
  const selectId = `${idPrefix}-group`;
  const customId = `${idPrefix}-group-name`;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={selectId}>{groupLabel}</Label>
        <select
          id={selectId}
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
        <Label htmlFor={customId}>{newGroupLabel}</Label>
        <Input
          id={customId}
          value={custom}
          onChange={(event) => onCustom(event.target.value)}
          className="h-11 text-base md:text-sm"
          maxLength={80}
          placeholder={placeholder}
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
