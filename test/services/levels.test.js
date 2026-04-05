/**
 * Tests associés à src/services/levels.js
 */
import { describe, it, expect } from 'vitest';
import { levelFromLifetimeDeposits, nextLevelInfo } from '../../src/services/levels.js';

describe('src/services/levels.js', () => {
  it('levelFromLifetimeDeposits retourne standard à zéro', () => {
    expect(levelFromLifetimeDeposits(0)).toBe('standard');
  });

  it('monte de palier selon les seuils', () => {
    expect(levelFromLifetimeDeposits(100_000)).toBe('classic');
    expect(levelFromLifetimeDeposits(2_000_000)).toBe('premier');
  });

  it('nextLevelInfo indique le palier suivant', () => {
    const info = nextLevelInfo(0);
    expect(info.current_level).toBe('standard');
    expect(info.next_level).toBe('classic');
    expect(info.amount_to_next_level_ar).toBe(100_000);
  });

  it('nextLevelInfo à palier max : plus de niveau suivant', () => {
    const info = nextLevelInfo(100_000_000);
    expect(info.next_level).toBeNull();
    expect(info.amount_to_next_level_ar).toBe(0);
  });
});
