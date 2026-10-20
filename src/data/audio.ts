import {getSpecies,type Element} from './kanto.ts';

export interface SoundNote{
 frequency:number;duration:number;delay?:number;end?:number;gain?:number;wave?:OscillatorType;attack?:number;
}
export interface SoundIdentity{pitch:number;length:number;glide:number;wave:OscillatorType;}
const COLORS:Record<Element,{pitch:number;glide:number;wave:OscillatorType}>={
 normal:{pitch:293.66,glide:.7,wave:'sine'},fire:{pitch:220,glide:.55,wave:'triangle'},
 water:{pitch:392,glide:1.3,wave:'sine'},grass:{pitch:329.63,glide:.8,wave:'triangle'},
 electric:{pitch:587.33,glide:.65,wave:'sine'},ice:{pitch:659.25,glide:.9,wave:'sine'},
 fighting:{pitch:164.81,glide:.5,wave:'triangle'},poison:{pitch:246.94,glide:.65,wave:'sine'},
 ground:{pitch:146.83,glide:.6,wave:'triangle'},flying:{pitch:440,glide:1.2,wave:'sine'},
 psychic:{pitch:493.88,glide:1.12,wave:'sine'},bug:{pitch:349.23,glide:.72,wave:'triangle'},
 rock:{pitch:130.81,glide:.55,wave:'triangle'},ghost:{pitch:277.18,glide:1.15,wave:'sine'},
 dragon:{pitch:196,glide:.75,wave:'triangle'},
};

/** Element gives the family its texture; species gives a stable pitch/envelope.
 * No random calls, recordings, harsh waveforms, or extra voices per character. */
export function soundIdentity(speciesId:number):SoundIdentity{
 const id=Number.isInteger(speciesId)&&speciesId>=1&&speciesId<=151?speciesId:1;
 const color=COLORS[getSpecies(id).types[0]];
 return {...color,pitch:color.pitch*2**(((id*7)%13-6)/12),length:.78+id/400};
}

export const MUSIC_STEP_SECONDS=.6; // 100 BPM, with space between melody notes.
const CHORDS=[[196,293.66],[130.81,196],[164.81,246.94],[146.83,220]] as const;
const MELODY=[392,null,493.88,null,440,null,null,293.66,329.63,null,392,null,587.33,null,null,null,
 493.88,null,440,null,392,null,null,329.63,293.66,null,440,null,392,null,null,null] as const;
/** A 19.2-second original phrase: warm open fifths, soft plucks, breathing room.
 * The second pass changes the ending instead of adding more layers. */
export function musicNotes(step:number):SoundNote[]{
 const index=step%MELODY.length,notes:SoundNote[]=[];
 if(index%8===0)for(const frequency of CHORDS[Math.floor(index/8)]){
  notes.push({frequency,duration:4.55,gain:.05,attack:.65});
 }
 const melody=step%64===60?329.63:MELODY[index];
 if(melody)notes.push({frequency:melody,duration:.85,gain:.09,attack:.025});
 return notes;
}
