import React from "react";
import { Box, Text } from "ink";

interface Column<T> {
  key: keyof T & string;
  label?: string;
  width?: number;
  color?: string | ((row: T) => string | undefined);
  dimColor?: boolean;
}

interface TableProps<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
}

export function Table<T extends Record<string, any>>({
  data,
  columns,
}: TableProps<T>) {
  return (
    <Box flexDirection="column">
      <Box>
        {columns.map((col) => (
          <Box key={col.key} width={col.width}>
            <Text bold>{col.label ?? col.key}</Text>
          </Box>
        ))}
      </Box>
      {data.map((row, ri) => (
        <Box key={ri}>
          {columns.map((col) => {
            const color =
              typeof col.color === "function" ? col.color(row) : col.color;
            return (
              <Box key={col.key} width={col.width}>
                <Text color={color} dimColor={col.dimColor}>
                  {String(row[col.key] ?? "—")}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
