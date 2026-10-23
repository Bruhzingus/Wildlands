export function downloadJSON(json:string,filename:string):void {
 const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),anchor=document.createElement('a');
 anchor.href=url;anchor.download=filename;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
