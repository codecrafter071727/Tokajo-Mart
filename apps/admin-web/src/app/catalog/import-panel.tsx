"use client";

import { CATALOG_CSV_COLUMNS, type CatalogImportResult } from "@qc/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ErrorBanner } from "../../components/catalog-ui";
import { Alert, Badge, Button, Panel, td, th, thNum, tdNum } from "../../components/kit";
import { catalogAdmin } from "../../lib/catalog-admin";

const MAX_BYTES = 1024 * 1024;

/**
 * Bulk add or edit products from a CSV file. A check runs first and lists every problem by line;
 * the import itself is all or nothing, so a file with any problem changes nothing.
 */
export function ImportPanel() {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checked, setChecked] = useState<CatalogImportResult | null>(null);
  const [applied, setApplied] = useState<CatalogImportResult | null>(null);

  const check = useMutation({
    mutationFn: (text: string) => catalogAdmin.importCsv(text, true),
    onSuccess: setChecked,
  });
  const apply = useMutation({
    mutationFn: (text: string) => catalogAdmin.importCsv(text, false),
    onSuccess: async (result) => {
      if (result.ok) {
        setApplied(result);
        setChecked(null);
        setFile(null);
        await client.invalidateQueries({ queryKey: ["admin-products"] });
        await client.invalidateQueries({ queryKey: ["product-groups"] });
      } else {
        setChecked(result);
      }
    },
  });
  const exporter = useMutation({ mutationFn: catalogAdmin.exportCsv });

  const pick = async (picked: File | undefined) => {
    setChecked(null);
    setApplied(null);
    setFileError(null);
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setFileError("That file is over 1 MB. Split it into smaller files.");
      return;
    }
    const text = await picked.text();
    setFile({ name: picked.name, text });
    check.mutate(text);
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Import products from CSV"
        description="Rows with an id update that product. Rows without one add a new product."
        actions={
          <Button small pending={exporter.isPending} onClick={() => exporter.mutate()}>
            Export current catalog
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-ink-2">
            Columns, in any order:{" "}
            <span className="font-mono text-[12px] text-muted">
              {CATALOG_CSV_COLUMNS.join(", ")}
            </span>
            . Prices are in rupees. Tags are separated by a semicolon or a pipe. Rows with the same{" "}
            <span className="font-mono text-[12px]">variant_group</span> become sizes of one item.
            Exporting first gives you a file in the right shape.
          </p>

          <div
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 px-6 py-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files[0]);
            }}
          >
            <p className="text-sm font-medium text-ink">
              {file ? file.name : "Drop a CSV file here"}
            </p>
            <p className="text-xs text-muted">
              Up to 1 MB. Nothing changes until you press Import.
            </p>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Choose a CSV file"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button small onClick={() => input.current?.click()}>
              {file ? "Choose another file" : "Choose a file"}
            </Button>
          </div>

          {fileError ? <Alert>{fileError}</Alert> : null}
          <ErrorBanner error={check.error ?? apply.error ?? exporter.error} />
          {check.isPending ? <p className="text-[13px] text-muted">Checking the file</p> : null}

          {applied ? (
            <Alert tone="success" title="Imported">
              {applied.creates} added, {applied.updates} updated
              {applied.groupsCreated.length
                ? `, new groups: ${applied.groupsCreated.join(", ")}`
                : ""}
              .
            </Alert>
          ) : null}
        </div>
      </Panel>

      {checked ? (
        <Panel
          title={checked.ok ? "Ready to import" : "Fix these rows first"}
          description={`${checked.rows} rows checked`}
          actions={
            checked.ok ? (
              <Button
                variant="primary"
                pending={apply.isPending}
                onClick={() => file && apply.mutate(file.text)}
              >
                Import {checked.creates + checked.updates} products
              </Button>
            ) : (
              <Badge tone="red">
                {checked.errors.length} {checked.errors.length === 1 ? "problem" : "problems"}
              </Badge>
            )
          }
          flush={!checked.ok}
        >
          {checked.ok ? (
            <dl className="grid grid-cols-3 gap-4 text-[13px]">
              <div>
                <dt className="text-muted">New products</dt>
                <dd className="tnum text-2xl font-bold text-ink">{checked.creates}</dd>
              </div>
              <div>
                <dt className="text-muted">Updated</dt>
                <dd className="tnum text-2xl font-bold text-ink">{checked.updates}</dd>
              </div>
              <div>
                <dt className="text-muted">New groups</dt>
                <dd className="text-[13px] text-ink">
                  {checked.groupsCreated.length ? checked.groupsCreated.join(", ") : "None"}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={thNum}>Line</th>
                    <th className={th}>Column</th>
                    <th className={th}>Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {checked.errors.map((e, i) => (
                    <tr key={`${e.line}-${e.column}-${i}`}>
                      <td className={tdNum}>{e.line}</td>
                      <td className={`${td} font-mono text-[12px] text-ink-2`}>
                        {e.column ?? "row"}
                      </td>
                      <td className={`${td} text-bad`}>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
