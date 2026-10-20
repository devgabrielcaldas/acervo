const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const src=fs.readFileSync('supabase/functions/catalog/catalog-utils.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,URL,Date,Set,Array,Number,Object,String,RegExp},{filename:'catalog-utils.ts'});
const u=mod.exports;
let passed=0;
function check(name,action){action();console.log('✓',name);passed++;}
check('categorias Google em inglês viram gêneros gerais em português',()=>{
const item=u.googleBooksResults({items:[{id:'a12',volumeInfo:{title:'Harry Potter e as Relíquias da Morte',authors:['J. K. Rowling'],language:'pt',categories:['Juvenile Fiction / Fantasy & Magic'],imageLinks:{thumbnail:'http://books.google.com/books/content?id=abc'},publishedDate:'2007-01-01'}}]})[0];
assert.equal(item.language,'pt');assert.deepEqual([...item.genres],['Fantasia','Infantojuvenil','Ficção']);assert.match(item.coverUrl,/^https:/);});
check('Open Library não cadastra Dementors / the Elder Wand como gênero',()=>{
 const genres=u.portugueseGenres(['the Elder Wand','dementors',"children's books",'Fantasy fiction']);
 assert(!genres.some(x=>/wand|dementor|children/i.test(x)));assert(genres.includes('Fantasia'));
});
check('Open Library retorna título e capa da edição portuguesa encontrada',()=>{
const r=u.openLibraryResults({docs:[{key:'/works/OL123W',title:'Harry Potter and the Deathly Hallows',author_name:['J. K. Rowling'],first_publish_year:2007,subject:['Magic','Fantasy fiction'],editions:{docs:[{title:'Harry Potter e as Relíquias da Morte',language:['por'],covers:[1234],publish_date:'2007'}]}}]})[0];
assert.equal(r.title,'Harry Potter e as Relíquias da Morte');assert.equal(r.language,'pt');assert.equal(r.year,2007);assert.match(r.coverUrl,/covers.openlibrary.org/);
});
check('edições localizadas de trabalhos são detectadas pelo campo languages',()=>{
const work={source:'open-library',id:'OL123W',kind:'book',title:'Harry Potter and the Deathly Hallows',genres:[],year:2007};
const result=u.portugueseWorkEdition({entries:[{title:'Harry Potter and the Deathly Hallows',languages:[{key:'/languages/eng'}]},{title:'Harry Potter e as Relíquias da Morte',languages:[{key:'/languages/por'}],covers:[42],publish_date:'2007'}]},work);
assert.equal(result.language,'pt');assert.equal(result.title,'Harry Potter e as Relíquias da Morte');assert.match(result.coverUrl,/42-L/);
});
check('resultados em português aparecem antes dos estrangeiros',()=>{
const x={source:'google-books',id:'g',kind:'book',title:'Harry Potter and the Deathly Hallows',language:'en',genres:[]};
const y={source:'open-library',id:'OL123W',kind:'book',title:'Harry Potter e as Relíquias da Morte',language:'pt',genres:[]};
assert.equal(u.mergeGoogleAndOpenLibrary([x],[y])[0].title,y.title);
});
check('capa Open Library com default false é aceita pela whitelist',()=>assert.ok(u.validateCoverUrl('https://covers.openlibrary.org/b/id/100-L.jpg?default=false')));
check('domínio malicioso é recusado',()=>assert.equal(u.validateCoverUrl('https://covers.openlibrary.org.evil.test/b/id/42-L.jpg'),null));
check('TMDB continua fornecendo título em português',()=>{const r=u.tmdbResults({results:[{id:234,title:'O Poderoso Chefão',poster_path:'/abc.jpg'}]},'movie');assert.equal(r[0].title,'O Poderoso Chefão')});
console.log(`${passed} testes de idioma aprovados`);
