import { App, TFile } from "obsidian";
import { ProletarianWizardSettings } from "./ProletarianWizardSettings";
import { LineOperations } from "./LineOperations";

export class TaskCreationService {
	constructor(private app: App, private settings: ProletarianWizardSettings) {}

	private async ensureTargetFile(): Promise<TFile> {
		const folder = this.settings.newTasksFolder || "To-Dos";
		const fileName = this.settings.newTasksFileName || "Inbox.md";
		const path = folder ? `${folder}/${fileName}` : fileName;

		// Ensure folder exists
		if (folder && !(await this.app.vault.adapter.exists(folder, false))) {
			const parts = folder.split("/").filter((p) => !!p);
			let current = "";
			for (const part of parts) {
				current = current ? `${current}/${part}` : part;
				if (!(await this.app.vault.adapter.exists(current, false))) {
					await this.app.vault.createFolder(current);
				}
			}
		}

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			return existing;
		}
		const file = await this.app.vault.create(path, `# Inbox\n\n`);
		return file;
	}

	private getEOL(content: string): string {
		return content.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
	}

	async appendTodo(text: string, dueISO?: string | null): Promise<void> {
		const file = await this.ensureTargetFile();
		const content = await this.app.vault.read(file);
		const eol = this.getEOL(content);
		const lo = new LineOperations(this.settings);
		const attrs = { textWithoutAttributes: text, attributes: {} as Record<string, string | boolean> };
		if (dueISO) {
			attrs.attributes[this.settings.dueDateAttribute || "due"] = dueISO;
		}
		const lineBody = lo.attributesToString(attrs);
		const line = `- [ ] ${lineBody}`;
		const newContent = `${content}${content.endsWith(eol) ? "" : eol}${line}${eol}`;
		await this.app.vault.modify(file, newContent);
	}
}


