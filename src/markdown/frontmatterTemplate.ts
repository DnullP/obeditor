export interface FrontmatterTemplateVariables {
  filename: string;
  directory: string;
  date: string;
}

export function buildFrontmatterTemplateVariables(
  relativePath: string,
  now: Date = new Date(),
): FrontmatterTemplateVariables {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/");
  const fullName = segments.pop() ?? normalizedPath;
  const directory = segments.join("/");
  const filename = fullName.replace(/\.(md|markdown)$/i, "");
  const date = [
    String(now.getFullYear()).padStart(4, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    filename,
    directory,
    date,
  };
}

export function expandFrontmatterTemplate(
  template: string,
  relativePath: string,
  now: Date = new Date(),
): string {
  const variables = buildFrontmatterTemplateVariables(relativePath, now);
  return template
    .replace(/\{\{filename\}\}/g, variables.filename)
    .replace(/\{\{date\}\}/g, variables.date)
    .replace(/\{\{directory\}\}/g, variables.directory);
}

export function normalizeFrontmatterBlock(expandedTemplate: string): string {
  const trimmed = expandedTemplate.trim();
  if (!trimmed) {
    return "---\n---";
  }

  if (trimmed.startsWith("---")) {
    return trimmed;
  }

  return `---\n${trimmed}\n---`;
}
