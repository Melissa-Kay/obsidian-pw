import { App, TFile } from "obsidian";
import { DateTime } from "luxon";
import { ProletarianWizardSettings } from "./ProletarianWizardSettings";

export interface WeeklyGoal {
	text: string;
	checked: boolean;
}

export class WeeklyGoalsService {
	private cachePrefix = "PW.WeeklyGoals";
	constructor(private app: App, private settings: ProletarianWizardSettings) {}

	private getWeekKey(date: DateTime): string {
		return `${date.weekYear}-W${date.weekNumber.toString().padStart(2, "0")}`;
	}

	private getWeeklyNotePath(date: DateTime): string {
		const folder = this.settings.goalsFolder || "Goals";
		const fileName = `${this.getWeekKey(date)}.md`;
		return folder ? `${folder}/${fileName}` : fileName;
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) return;
		if (!(await this.app.vault.adapter.exists(folderPath, false))) {
			// Recursively create parent folders
			const parts = folderPath.split("/").filter((p) => !!p);
			let current = "";
			for (const part of parts) {
				current = current ? `${current}/${part}` : part;
				if (!(await this.app.vault.adapter.exists(current, false))) {
					await this.app.vault.createFolder(current);
				}
			}
		}
	}

	private async readFileContent(path: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}
		return null;
	}

	private async writeFileContent(path: string, content: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.app.vault.modify(file, content);
		} else {
			const lastSlash = path.lastIndexOf("/");
			const folder = lastSlash >= 0 ? path.substring(0, lastSlash) : "";
			await this.ensureFolderExists(folder);
			await this.app.vault.create(path, content);
		}
	}

	private parseGoalsFromSection(sectionContent: string): WeeklyGoal[] {
		const lines = sectionContent.split("\n");
		const goals: WeeklyGoal[] = [];
		for (const line of lines) {
			const m = /^\s*-\s*\[( |x|X)\]\s+(.*)$/.exec(line);
			if (m) {
				goals.push({
					checked: m[1].toLowerCase() === "x",
					text: m[2].trim(),
				});
			}
		}
		return goals;
	}

	private replaceGoalsSection(content: string, goals: WeeklyGoal[]): string {
		const sectionHeader = /^##\s+Weekly Goals\s*$/im;
		const lines = content.split("\n");
		let start = -1;
		for (let i = 0; i < lines.length; i++) {
			if (sectionHeader.test(lines[i])) {
				start = i;
				break;
			}
		}
		const renderedGoals = ["## Weekly Goals", ...goals.map((g) => `- [${g.checked ? "x" : " "}] ${g.text}`)];
		if (start >= 0) {
			// Find end of section (next heading or EOF)
			let end = lines.length;
			for (let i = start + 1; i < lines.length; i++) {
				if (/^#{1,6}\s+/.test(lines[i])) {
					end = i;
					break;
				}
			}
			const newLines = [...lines.slice(0, start), ...renderedGoals, ...lines.slice(end)];
			return newLines.join("\n");
		} else {
			// Insert at top with a simple title if none
			if (lines.length === 0 || !/^#\s+/.test(lines[0])) {
				return [`# ${this.getWeekKey(DateTime.now())}`, "", ...renderedGoals, "", ...lines].join("\n");
			}
			return [...renderedGoals, "", ...lines].join("\n");
		}
	}

	private extractGoalsSection(content: string): WeeklyGoal[] {
		const headerRegex = /^##\s+Weekly Goals\s*$/im;
		const idx = content.search(headerRegex);
		if (idx < 0) return [];
		const lines = content.split("\n");
		let start = -1;
		for (let i = 0; i < lines.length; i++) {
			if (headerRegex.test(lines[i])) {
				start = i + 1;
				break;
			}
		}
		if (start < 0) return [];
		let end = lines.length;
		for (let i = start; i < lines.length; i++) {
			if (/^#{1,6}\s+/.test(lines[i])) {
				end = i;
				break;
			}
		}
		return this.parseGoalsFromSection(lines.slice(start, end).join("\n"));
	}

	async readGoals(date: DateTime): Promise<WeeklyGoal[]> {
		const key = this.getWeekKey(date);
		// Try cache first
		const cached = localStorage.getItem(`${this.cachePrefix}.${key}`);
		if (cached) {
			try {
				return JSON.parse(cached) as WeeklyGoal[];
			} catch {}
		}
		// Read file
		const path = this.getWeeklyNotePath(date);
		const content = await this.readFileContent(path);
		if (!content) {
			return [];
		}
		const goals = this.extractGoalsSection(content);
		localStorage.setItem(`${this.cachePrefix}.${key}`, JSON.stringify(goals));
		return goals;
	}

	private async readPreviousWeekUnchecked(date: DateTime): Promise<WeeklyGoal[]> {
		const prev = date.minus({ weeks: 1 });
		const prevGoals = await this.readGoals(prev);
		return prevGoals.filter((g) => !g.checked);
	}

	async writeGoals(date: DateTime, goals: WeeklyGoal[]): Promise<void> {
		const key = this.getWeekKey(date);
		const path = this.getWeeklyNotePath(date);
		let content = (await this.readFileContent(path)) ?? `# ${this.getWeekKey(date)}\n\n`;
		// If the file is new and has no section, consider carry-forward
		const hadSection = /(^|\n)##\s+Weekly Goals\s*($|\n)/i.test(content);
		if (!hadSection && goals.length === 0) {
			const carry = await this.readPreviousWeekUnchecked(date);
			if (carry.length > 0) {
				goals = carry.slice(0, Math.max(1, Math.min(this.settings.maxWeeklyGoals || 3, carry.length)));
			}
		}
		// Trim to max
		const max = Math.max(1, Math.min(this.settings.maxWeeklyGoals || 3, goals.length));
		const trimmed = goals.slice(0, max);
		const newContent = this.replaceGoalsSection(content, trimmed);
		await this.writeFileContent(path, newContent);
		localStorage.setItem(`${this.cachePrefix}.${key}`, JSON.stringify(trimmed));
	}
}


