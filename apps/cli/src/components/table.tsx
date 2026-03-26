import React from "react";
import { Box, Text } from "ink";
import { match, P } from "ts-pattern";

interface Column<T> {
  key: keyof T & string;
  label?: string;
  width?: number;
  color?: string | ((row: T) => string | undefined);
  dimColor?: boolean;
}

type Layout = "table" | "kv";

interface NestedTable {
  data: Record<string, any>[];
  columns?: Column<Record<string, any>>[];
  layout?: Layout;
}

interface TableProps<T extends Record<string, any>> {
  data: (T & { children?: NestedTable })[];
  columns?: Column<T>[];
  layout?: Layout;
  indent?: number;
}

interface RowProps {
  layout: Layout;
  row: Record<string, any>;
  columns: Column<Record<string, any>>[];
}

function Row({ layout, row, columns }: RowProps) {
  const { children, ...data } = row;

  const nested = match(children)
    .with(P.not(P.nullish), ({ data: d, columns: cols, layout: lay }) => (
      <Table data={d} columns={cols} layout={lay} indent={2} />
    ))
    .otherwise(() => null);

  return match(layout)
    .with("kv", () => (
      <Box flexDirection="column">
        <Box>
          {Object.entries(data).map(([k, v]) => (
            <Box key={k}>
              <Box width={16}>
                <Text bold>{k}</Text>
              </Box>
              <Text dimColor>{String(v ?? "—")}</Text>
            </Box>
          ))}
        </Box>
        {nested}
      </Box>
    ))
    .otherwise(() => (
      <Box flexDirection="column">
        <Box>
          {columns.map((col) => {
            const color =
              typeof col.color === "function" ? col.color(data) : col.color;
            return (
              <Box key={col.key} width={col.width}>
                <Text color={color} dimColor={col.dimColor}>
                  {String(data[col.key] ?? "—")}
                </Text>
              </Box>
            );
          })}
        </Box>
        {nested}
      </Box>
    ));
}

export function Table<T extends Record<string, any>>({
  data,
  columns = [],
  layout = "table",
  indent = 0,
}: TableProps<T>) {
  return (
    <Box flexDirection="column" marginLeft={indent}>
      {match(layout)
        .with("table", () => (
          <Box>
            {columns.map((col) => (
              <Box key={col.key} width={col.width}>
                <Text bold>{col.label ?? col.key}</Text>
              </Box>
            ))}
          </Box>
        ))
        .with("kv", () => null)
        .exhaustive()}
      {data.map((row, ri) => (
        <Row key={ri} layout={layout} row={row} columns={columns} />
      ))}
    </Box>
  );
}
