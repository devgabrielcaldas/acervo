const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('src/services/catalogClient.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let count=0;
const supabase={functions:{invoke:async(name,{body})=>{
  assert.equal(name,'catalog');assert.equal(body.action,'image');
  count++;
  if(count===1)return {data:null,error:new Error('Capa Google Books indisponível')};
  return {data:new Blob([new Uint8Array(1000)],{type:'image/jpeg'}),error:null};
}}};
const moduleObject={exports:{}};
vm.runInNewContext(compiled,{module:moduleObject,exports:moduleObject.exports,require:id=>{
 if(id!=='../lib/supabase')throw Error('Importação inesperada '+id);
 return {requireSupabase:()=>supabase};
},Blob,File,Set,Error,Response,console});
(async()=>{
  const file=await moduleObject.exports.downloadCatalogCover('https://books.google.com/books/content?id=abc','https://covers.openlibrary.org/b/isbn/9780545010221-L.jpg?default=false');
  assert.equal(count,2);assert.equal(file.type,'image/jpeg');assert.equal(file.size,1000);
  console.log('✓ Falha da primeira capa utiliza alternativa por ISBN sem impedir o cadastro');
})().catch(e=>{console.error(e);process.exitCode=1});
