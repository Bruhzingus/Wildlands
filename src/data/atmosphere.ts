export interface AtmosphereKey {
 seconds:number;sky:string;fog:string;ambient:string;sun:string;
 ambientScale:number;sunScale:number;fogStart:number;fogEnd:number;
}

/** Shared run phases, independently authored biome tints. Hold the final phase
 * in endless mode: no dusk-to-noon reset and no new gameplay clock. */
export const ATMOSPHERES:Readonly<Record<'wildlands'|'pine'|'volcanic',readonly AtmosphereKey[]>>={
 wildlands:[
  {seconds:0,sky:'#afd0d8',fog:'#c3c9b0',ambient:'#eff5f1',sun:'#ffe5ba',ambientScale:1,sunScale:1,fogStart:55,fogEnd:205},
  {seconds:300,sky:'#bfd0cf',fog:'#ccc9ac',ambient:'#fff7e8',sun:'#ffdfad',ambientScale:1,sunScale:1.02,fogStart:55,fogEnd:205},
  {seconds:600,sky:'#dfc2ac',fog:'#d0bda4',ambient:'#f7eade',sun:'#ffd0a4',ambientScale:.98,sunScale:.98,fogStart:53,fogEnd:200},
  {seconds:780,sky:'#c4a3a3',fog:'#b8a7a5',ambient:'#eadfe4',sun:'#f4c6ac',ambientScale:.94,sunScale:.9,fogStart:51,fogEnd:195},
  {seconds:900,sky:'#a69daf',fog:'#aaa5b4',ambient:'#e3dfed',sun:'#e8c4bd',ambientScale:.92,sunScale:.84,fogStart:50,fogEnd:190},
 ],
 pine:[
  {seconds:0,sky:'#acc5c4',fog:'#b3c0ad',ambient:'#e6f0ec',sun:'#f9e6bf',ambientScale:1,sunScale:.96,fogStart:46,fogEnd:175},
  {seconds:300,sky:'#bac9be',fog:'#bdc2aa',ambient:'#e9eee0',sun:'#f6dfb6',ambientScale:1,sunScale:1,fogStart:46,fogEnd:175},
  {seconds:600,sky:'#bdb4a6',fog:'#b2b2a1',ambient:'#e5e7dc',sun:'#f2cea2',ambientScale:.99,sunScale:.97,fogStart:45,fogEnd:170},
  {seconds:780,sky:'#aaa5aa',fog:'#a1aaa6',ambient:'#dee3e8',sun:'#e7c3b0',ambientScale:.96,sunScale:.9,fogStart:44,fogEnd:165},
  {seconds:900,sky:'#929fab',fog:'#96a7aa',ambient:'#dbe2ee',sun:'#d9bfbc',ambientScale:.94,sunScale:.85,fogStart:44,fogEnd:165},
 ],
 volcanic:[
  {seconds:0,sky:'#dbb49a',fog:'#b89e8b',ambient:'#fff1e7',sun:'#ffe7cf',ambientScale:1,sunScale:1,fogStart:60,fogEnd:220},
  {seconds:300,sky:'#d5ad91',fog:'#b69a86',ambient:'#faebdf',sun:'#ffdbb8',ambientScale:1,sunScale:1,fogStart:60,fogEnd:220},
  {seconds:600,sky:'#c99d83',fog:'#b18e7d',ambient:'#f2e2d9',sun:'#f6c49c',ambientScale:.99,sunScale:.97,fogStart:58,fogEnd:215},
  {seconds:780,sky:'#b98e80',fog:'#a88a82',ambient:'#e9dad8',sun:'#edb59e',ambientScale:.96,sunScale:.91,fogStart:56,fogEnd:210},
  {seconds:900,sky:'#a68b91',fog:'#9f8c92',ambient:'#e4dce5',sun:'#dfb2aa',ambientScale:.94,sunScale:.87,fogStart:55,fogEnd:205},
 ],
};
