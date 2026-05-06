import { MacroEventsPanel } from '../../macro/MacroEventsPanel';

export default function MacroWidget() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <MacroEventsPanel />
    </div>
  );
}
