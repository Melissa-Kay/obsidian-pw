import * as React from "react";
import { DateTime } from "luxon";
import { WeeklyGoal, WeeklyGoalsService } from "../domain/WeeklyGoalsService";
import { ProletarianWizardSettings } from "../domain/ProletarianWizardSettings";

export interface WeeklyGoalsComponentProps {
  service: WeeklyGoalsService;
  settings: ProletarianWizardSettings;
}

export function WeeklyGoalsComponent({ service, settings }: WeeklyGoalsComponentProps) {
  const [goals, setGoals] = React.useState<WeeklyGoal[]>([]);
  const max = Math.max(1, Math.min(settings.maxWeeklyGoals || 3, 3));

  React.useEffect(() => {
    let mounted = true;
    service.readGoals(DateTime.now()).then((g) => {
      if (mounted) setGoals(g.slice(0, max));
    });
    return () => { mounted = false; }
  }, [service, max]);

  const save = React.useCallback(async (updated: WeeklyGoal[]) => {
    setGoals(updated.slice(0, max));
    await service.writeGoals(DateTime.now(), updated.slice(0, max));
  }, [service, max]);

  const toggleGoal = (idx: number) => {
    const updated = goals.slice();
    updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
    save(updated);
  };

  const updateText = (idx: number, text: string) => {
    const updated = goals.slice();
    updated[idx] = { ...updated[idx], text };
    save(updated);
  };

  const addGoal = () => {
    if (goals.length >= max) return;
    const updated = goals.concat([{ text: "", checked: false }]);
    save(updated);
  };

  const removeGoal = (idx: number) => {
    const updated = goals.slice(0, idx).concat(goals.slice(idx + 1));
    save(updated);
  };

  return (
    <div className="pw-weekly-goals">
      <div className="pw-weekly-goals-title">🎯 Weekly Goals</div>
      <div className="pw-weekly-goals-items">
        {goals.map((g, idx) => (
          <div className="pw-weekly-goal" key={`goal-${idx}`}>
            <input
              type="checkbox"
              className="pw-weekly-goal-checkbox"
              checked={g.checked}
              onChange={() => toggleGoal(idx)}
            />
            <input
              type="text"
              className="pw-weekly-goal-input"
              placeholder={`Goal ${idx + 1}`}
              value={g.text}
              onChange={(e) => updateText(idx, e.target.value)}
            />
            <button
              className="pw-weekly-goal-remove"
              onClick={() => removeGoal(idx)}
              aria-label="Remove goal"
              title="Remove goal"
            >
              ✕
            </button>
          </div>
        ))}
        {goals.length < max && (
          <button className="pw-weekly-goal-add" onClick={addGoal} title="Add goal">
            ＋ Add goal
          </button>
        )}
      </div>
    </div>
  );
}


