import { describe,expect,it } from 'vitest';
import { transformKeys } from './transport';

describe('API field mapping', () => {
  it('maps nested economics while preserving metric keys and IDs', () => {
    const wire = { unit_economics: { revenue_per_unit_php_monthly: 100 }, values: { revenue_php: 200 }, applicant_counts: { ven_test: 2 }, milestones: [{ metric_key: 'revenue_php', tranche_pct: 5 }] };
    const domain = transformKeys(wire, 'camel');
    expect(domain).toEqual({ unitEconomics: { revenuePerUnitPhpMonthly: 100 }, values: { revenue_php: 200 }, applicantCounts: { ven_test: 2 }, milestones: [{ metricKey: 'revenue_php', tranchePct: 5 }] });
    expect(transformKeys(domain, 'snake')).toEqual(wire);
  });
  it('keeps null and scalar values intact', () => {
    expect(transformKeys({ location: null, note: 'do_not_change', count: 0 }, 'camel')).toEqual({ location: null, note: 'do_not_change', count: 0 });
  });
});
