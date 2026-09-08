export function parseSubjectRows(rows: string[]) {
  const parsed = rows
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const separator = line.search(/[：:]/);
      if (separator > 0) {
        const name = line.slice(0, separator).trim();
        const description = line.slice(separator + 1).trim();
        return description ? [{ name: name.slice(0, 40), description }] : [];
      }

      return [{ name: line.slice(0, 40), description: line }];
    });

  return parsed.map((subject, index) => ({
    clientId: `subject-${index + 1}`,
    ...subject,
  }));
}
