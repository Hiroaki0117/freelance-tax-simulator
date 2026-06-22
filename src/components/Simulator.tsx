'use client';

import { useMemo, useState } from 'react';
import { calculateTax } from '@/lib/tax/calculator';
import { DEFAULT_INPUT } from '@/lib/tax/defaults';
import type { TaxInput } from '@/lib/tax/types';
import { SimulatorForm } from './SimulatorForm';
import { ResultPanel } from './ResultPanel';
import { ChatPanel } from './ChatPanel';

export function Simulator() {
  const [input, setInput] = useState<TaxInput>(DEFAULT_INPUT);

  const result = useMemo(() => calculateTax(input), [input]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-6 lg:sticky lg:top-8 lg:self-start">
        <SimulatorForm input={input} onChange={setInput} />
      </section>
      <section className="space-y-6">
        <ResultPanel result={result} />
        <ChatPanel input={input} result={result} />
      </section>
    </div>
  );
}
