import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

/**
 * Collects exported names from a TypeScript entry point, following:
 * - `export * from './x.js'` (recursively),
 * - `export { local as alias }` (both names),
 * - `export { x } from './x.js'` (listed names only),
 * - `export * as namespace from './x.js'` (namespace plus its members),
 * - exported declarations and default exports.
 *
 * Limitation: this is a name/surface guard. It does not inspect function
 * bodies, so it cannot prove that no implementation path mints authority
 * indirectly.
 */
export function collectExportedNames(entryPath: string): Set<string> {
  const exported = new Set<string>();
  const visited = new Set<string>();

  const visit = (filePath: string): void => {
    if (visited.has(filePath)) {
      return;
    }
    visited.add(filePath);
    const source = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true);

    for (const statement of source.statements) {
      collectDeclaration(statement, exported);

      if (ts.isExportAssignment(statement)) {
        exported.add('default');
      }

      if (!ts.isExportDeclaration(statement)) {
        continue;
      }

      const target =
        statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
          ? resolve(dirname(filePath), statement.moduleSpecifier.text.replace(/\.js$/, '.ts'))
          : undefined;

      if (statement.exportClause === undefined) {
        if (target !== undefined) {
          visit(target);
        }
        continue;
      }

      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exported.add(element.name.text);
          if (element.propertyName !== undefined) {
            exported.add(element.propertyName.text);
          }
        }
        continue;
      }

      if (ts.isNamespaceExport(statement.exportClause)) {
        exported.add(statement.exportClause.name.text);
        if (target !== undefined) {
          visit(target);
        }
      }
    }
  };

  visit(entryPath);
  return exported;
}

function collectDeclaration(statement: ts.Statement, exported: Set<string>): void {
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
  if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) !== true) {
    return;
  }

  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    if (statement.name !== undefined) {
      exported.add(statement.name.text);
    }
    return;
  }

  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        exported.add(declaration.name.text);
      }
    }
  }
}
