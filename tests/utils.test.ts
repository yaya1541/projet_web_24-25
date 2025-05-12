// utils.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { add } from './utils.ts';

Deno.test('add function adds two numbers correctly', () => {
    assertEquals(add(2, 3), 5);
    assertEquals(add(-1, 1), 0);
});
