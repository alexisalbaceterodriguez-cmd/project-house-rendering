import { describe,expect,it } from 'vitest';
import { demoProject } from '../data/defaultProject';
import { budgetCsv,budgetTotal } from '../lib/budget';
describe('Presupuesto introducido por el usuario',()=>{
  it('suma en céntimos y distingue objetos sin precio de los gratuitos',()=>{const items=structuredClone(demoProject.furniture.slice(0,3));items[0].unitPrice=.1;items[1].unitPrice=.2;expect(budgetTotal(items)).toEqual({total:.3,priced:2,missing:1});items[2].unitPrice=0;expect(budgetTotal(items).missing).toBe(0);});
  it('escapa nombres y neutraliza fórmulas al abrir el CSV',()=>{const items=structuredClone(demoProject.furniture.slice(0,1));items[0].name='=HYPERLINK("x")';items[0].unitPrice=120.5;const csv=budgetCsv(items);expect(csv).toContain('"\'=HYPERLINK(""x"")"');expect(csv).toContain('"120.50"');});
});
