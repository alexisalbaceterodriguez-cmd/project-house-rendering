import type { Project } from '../types';

// Committed project objects are never mutated (every edit starts from a structuredClone),
// so their serialisation can be cached by identity.
const serialised=new WeakMap<object,string>();
function key(value:object){let text=serialised.get(value);if(text===undefined){text=JSON.stringify(value);serialised.set(value,text);}return text;}

type Identified={id:string};
const LISTS=['furniture','walls','openings','rooms','materials'] as const;
const OBJECTS=['palette','render'] as const;

function shareList<T extends Identified>(previous:T[]|undefined,next:T[]|undefined):T[]|undefined{
  if(!previous||!next)return next;
  const byId=new Map(previous.map(item=>[item.id,item]));
  let same=previous.length===next.length;
  const shared=next.map((item,i)=>{
    const old=byId.get(item.id);
    const reuse=old&&key(old)===key(item)?old:item;
    if(reuse!==previous[i])same=false;
    return reuse;
  });
  return same?previous:shared;
}

/**
 * Reuse the previous edit's objects for every furniture item, wall, opening, room or material
 * that an edit left unchanged, so the 2D plan and 3D view only re-render what actually changed.
 * Equality is by value (JSON), never by assumption; the returned project is a new object.
 */
export function shareUnchanged(previous:Project,next:Project):Project{
  const result={...next} as Record<string,unknown>;
  const prev=previous as unknown as Record<string,unknown>;
  for(const name of LISTS)result[name]=shareList(prev[name] as Identified[]|undefined,result[name] as Identified[]|undefined);
  for(const name of OBJECTS){const a=prev[name],b=result[name];if(a&&b&&typeof a==='object'&&typeof b==='object'&&key(a)===key(b))result[name]=a;}
  return result as unknown as Project;
}
