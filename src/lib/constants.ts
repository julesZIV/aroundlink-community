export const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77','#1b4332','#6b2737','#7b3f00']

export const CHANNELS = [
  { id:'erasmus-plus',   emoji:'🇪🇺', name:'Erasmus+',            members:120, desc:'Erasmus+ partnerships, funding & procedures' },
  { id:'bip-programs',   emoji:'🎓',  name:'Programmes BIP',       members:85,  desc:'Blended Intensive Programmes coordination' },
  { id:'double-degrees', emoji:'🤝',  name:'Double Degrees',        members:63,  desc:'Double degree & joint programs' },
  { id:'ewp-help',       emoji:'📋',  name:'EWP Help',              members:48,  desc:'Technical support for the EWP platform' },
  { id:'germany',        emoji:'🇩🇪', name:'Germany',               members:24,  desc:'German university partnerships & tips' },
  { id:'asia-pacific',   emoji:'🌏',  name:'Asia-Pacific',          members:22,  desc:'Partnerships with Asian universities' },
  { id:'north-america',  emoji:'🇺🇸', name:'North America',         members:17,  desc:'US & Canada exchange programs' },
  { id:'mobility-data',  emoji:'📊',  name:'Mobility Data',         members:41,  desc:'Share & discuss student mobility stats' },
  { id:'africa',         emoji:'🌍',  name:'Coopération Afrique',   members:14,  desc:'African university partnerships & development' },
  { id:'general',        emoji:'💬',  name:'General',               members:200, desc:'General discussions for the community' },
]

export const COMMUNITY_USERS = [
  { id:'SL', name:'Sophie Leclerc', inst:'INSA Lyon',        color:'#2d4f7f' },
  { id:'PM', name:'Pierre Martin',  inst:'CentraleSupélec',  color:'#0f4c81' },
  { id:'LB', name:'Lucas Bernard',  inst:'Mines Paris',      color:'#1e6091' },
  { id:'MD', name:'Marie Dupont',   inst:'Polytechnique',    color:'#184e77' },
]

export const CHIPS_REWARDS = {
  feed_post:    5,
  channel_post: 5,
  upload:       15,
  claim:        25,
  contribution: 10,
  org_request:  5,
} as const

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
