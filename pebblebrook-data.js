// ============================================================
//  PEBBLEBROOK - game data
//  This file is the easy place to change things:
//  blocks, villagers, pet names and quests are all plain lists.
//  Edit, save, then refresh the page in the browser.
// ============================================================

// ---- World layout -------------------------------------------------
const WORLD = {
  W: 96, D: 96, H: 48,        // size of the island world in blocks
  SEA: 12,                    // sea level
  SEED: 20261110,             // change this number for a different island
  VILLAGE: { x: 48, z: 48 },  // centre of the village square
  POND: { x: 52, z: 59 },     // centre of the duck pond
  HILL: { x: 72, z: 30 },     // the hill with the crystal cave
  DAY_LENGTH: 600             // seconds for one full day and night
};
WORLD.GROUND = WORLD.SEA + 3; // height of the flat village ground

// ---- Block and item ids ------------------------------------------
const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
  BLOSSOM: 8, PLANKS: 9, FLOWER_PINK: 10, FLOWER_YELLOW: 11, FLOWER_BLUE: 12,
  FLOWER_LILAC: 13, BERRY_BUSH: 14, WHEAT: 15, LANTERN: 16, CRYSTAL: 17,
  CAKE: 18, BED: 19, CANDY_PINK: 20, CANDY_MINT: 21, CANDY_LILAC: 22,
  CANDY_LEMON: 23, HIVE: 24, PATH: 25, BRICK: 26, OVEN: 27, NEST: 28,
  BEDROCK: 29,
  // things you carry but cannot place:
  BERRY: 50, EGG: 51, HONEY: 52
};

// shape: 'cube' (normal block), 'cross' (flat plant), 'small' (little cube)
// layer: 'opaque', 'cutout' (has see-through holes), 'water', 'glow' (shines at night)
// tiles: [top, side, bottom] texture names from textures.js
// drop:  what you get when you break it (defaults to the block itself)
const BLOCKS = {};
function defBlock(id, name, tiles, opts) {
  const o = Object.assign({
    id: id, name: name, shape: 'cube', layer: 'opaque', breakable: true,
    placeable: true, color: '#ffffff'
  }, opts || {});
  o.tiles = typeof tiles === 'string' ? [tiles, tiles, tiles] : tiles;
  o.icon = o.icon || o.tiles[1];
  if (o.solid === undefined) o.solid = o.shape !== 'cross';
  o.opaque = o.shape === 'cube' && o.layer === 'opaque';
  if (o.drop === undefined) o.drop = id;
  BLOCKS[id] = o;
}
function defItem(id, name, icon) {
  BLOCKS[id] = { id: id, name: name, icon: icon, item: true, placeable: false };
}

defBlock(B.GRASS, 'Grass', ['grass_top', 'grass_side', 'dirt'], { color: '#9be08a' });
defBlock(B.DIRT, 'Dirt', 'dirt', { color: '#c49a74' });
defBlock(B.STONE, 'Stone', 'stone', { color: '#b9b7c9' });
defBlock(B.SAND, 'Sand', 'sand', { color: '#f7e6b5' });
defBlock(B.WATER, 'Water', 'water', { layer: 'water', solid: false, breakable: false, placeable: false });
defBlock(B.LOG, 'Wood', ['log_top', 'log_side', 'log_top'], { color: '#b58a62' });
defBlock(B.LEAVES, 'Leaves', 'leaves', { layer: 'cutout', solid: false, color: '#7fcf8f' });
defBlock(B.BLOSSOM, 'Blossom', 'blossom', { layer: 'cutout', solid: false, color: '#ffb7d0' });
defBlock(B.PLANKS, 'Planks', 'planks', { color: '#f0cf9d' });
defBlock(B.FLOWER_PINK, 'Pink Flower', 'flower_pink', { shape: 'cross', layer: 'cutout', color: '#ff9ec4' });
defBlock(B.FLOWER_YELLOW, 'Yellow Flower', 'flower_yellow', { shape: 'cross', layer: 'cutout', color: '#ffe27a' });
defBlock(B.FLOWER_BLUE, 'Blue Flower', 'flower_blue', { shape: 'cross', layer: 'cutout', color: '#9cc9ff' });
defBlock(B.FLOWER_LILAC, 'Lilac Flower', 'flower_lilac', { shape: 'cross', layer: 'cutout', color: '#cfa9ff' });
defBlock(B.BERRY_BUSH, 'Berry Bush', 'bush', { shape: 'cross', layer: 'cutout', drop: B.BERRY, placeable: false, color: '#ff6f91' });
defBlock(B.WHEAT, 'Wheat', 'wheat', { shape: 'cross', layer: 'cutout', color: '#f2cf63' });
defBlock(B.LANTERN, 'Lantern', 'lantern', { shape: 'small', layer: 'glow', color: '#ffe9a3' });
defBlock(B.CRYSTAL, 'Glow Crystal', 'crystal', { shape: 'small', layer: 'glow', color: '#b8f3ff' });
defBlock(B.CAKE, 'Cake', ['cake_top', 'cake_side', 'cake_side'], { color: '#ffc1d6' });
defBlock(B.BED, 'Cosy Bed', ['bed_top', 'bed_side', 'planks'], { color: '#ffb3c8' });
defBlock(B.CANDY_PINK, 'Pink Candy Block', 'candy_pink', { color: '#ffb3d1' });
defBlock(B.CANDY_MINT, 'Mint Candy Block', 'candy_mint', { color: '#aef0d1' });
defBlock(B.CANDY_LILAC, 'Lilac Candy Block', 'candy_lilac', { color: '#d5bbff' });
defBlock(B.CANDY_LEMON, 'Lemon Candy Block', 'candy_lemon', { color: '#fff3a3' });
defBlock(B.HIVE, 'Beehive', 'hive', { drop: B.HONEY, placeable: false, color: '#f4c257' });
defBlock(B.PATH, 'Cobble Path', 'path', { color: '#e6d8c3' });
defBlock(B.BRICK, 'Rosy Brick', 'brick', { color: '#f2a7a0' });
defBlock(B.OVEN, 'Oven', 'oven', { color: '#b9b7c9' });
defBlock(B.NEST, 'Nest', 'nest', { shape: 'cross', layer: 'cutout', drop: B.EGG, placeable: false, color: '#c49a74' });
defBlock(B.BEDROCK, 'Bedrock', 'bedrock', { breakable: false, placeable: false });
defItem(B.BERRY, 'Berry', 'berry');
defItem(B.EGG, 'Egg', 'egg');
defItem(B.HONEY, 'Honey', 'honey');

// ---- Villagers ----------------------------------------------------
// pos is [x, z] measured from the centre of the village square.
const VILLAGERS = {
  hazel: {
    name: 'Hazel', pos: [-3, -1], dress: '#8fd6b4', hair: '#a8683c', skin: '#ffe0c7',
    chatter: [
      'I built every house in Pebblebrook. Well... all three of them!',
      'A good house starts with a good floor. And snacks.',
      'Try the candy blocks if you find some. They make lovely roofs.'
    ]
  },
  clover: {
    name: 'Clover', pos: [-1, -3.4], dress: '#ffb3c8', hair: '#ffd66b', skin: '#f6d2b8',
    chatter: [
      'Bunnies love berries. Three berries and you have a friend for life.',
      'Flowers can be planted on almost anything. I checked.',
      'The blossom trees are my favourite. Pink everywhere!'
    ]
  },
  pip: {
    name: 'Pip', pos: [1.6, -3.4], dress: '#a9c8ff', hair: '#5b4a8a', skin: '#e8b998',
    chatter: [
      'I light the lanterns every evening. It is the best job.',
      'If you get lost, follow the little house arrow at the top of the screen.',
      'The ducks at the pond splash me every single time.'
    ]
  },
  honeybun: {
    name: 'Honeybun', pos: [3.4, -1], dress: '#fff1c9', hair: '#f29a7a', skin: '#ffd9bf', hat: '#ffffff',
    chatter: [
      'Everything tastes better with honey. Everything!',
      'I am inventing a cake that is also a hat. Do not tell anyone.',
      'Wheat grows in the little field just west of the square.'
    ]
  }
};

const PET_NAMES = ['Mochi', 'Biscuit', 'Pudding', 'Clementine', 'Waffles', 'Peaches', 'Noodle',
  'Marshmallow', 'Sprout', 'Button', 'Tofu', 'Pickle', 'Cocoa', 'Dumpling', 'Poppy', 'Bean'];

// ---- Quests -------------------------------------------------------
// Quests happen in this order. To add your own, copy one and change it.
// Goal types:
//   collect  - pick up `count` of `item` after the quest starts
//   have     - be carrying `count` of `item` when you return
//   place    - place `count` blocks (optional `items` list, optional `near` + `radius`)
//   befriend - make friends with `count` pets of type `pet`
//   event    - something special happens `count` times (used by the ducklings)
//   petsAt   - have `count` pets with you near the village square
// take:    items handed over when the quest is finished
// rewards: items given when the quest is finished
// onStart / onComplete: special effects handled in game.js
const QUESTS = [
  {
    title: 'A Roof of Your Own',
    giver: 'hazel',
    offer: [
      'Oh! A new neighbour! Welcome to Pebblebrook!',
      'Every neighbour needs a cosy little house. Shall we get you started?',
      'Gather some wood from the trees, then build something. Anything! Even a wobbly tower counts.'
    ],
    goals: [
      { type: 'collect', item: B.LOG, count: 6, text: 'Gather wood from trees' },
      { type: 'place', count: 10, text: 'Place blocks to build something' }
    ],
    remind: 'Left click on tree trunks to gather wood, then right click to place blocks.',
    done: [
      'You built something! I love it. Very... architectural.',
      'Here, take a cosy bed, some lanterns and a big stack of planks for your house.'
    ],
    rewards: [[B.BED, 1], [B.LANTERN, 2], [B.PLANKS, 24]]
  },
  {
    title: 'Berry Hungry',
    giver: 'clover',
    offer: [
      'Psst. Have you seen the bunnies hopping around the meadow?',
      'They are terribly shy, but they simply cannot resist berries.',
      'Pick some berries from the bushes, then offer them to a bunny. I think it will follow you home!'
    ],
    goals: [
      { type: 'collect', item: B.BERRY, count: 5, text: 'Pick berries from berry bushes' },
      { type: 'befriend', pet: 'bunny', count: 1, text: 'Feed a bunny until it is your friend' }
    ],
    remind: 'Berry bushes have little pink berries on them. Click a bunny to feed it. It takes three berries!',
    done: [
      'Oh my goodness, look at that little face! You have a bunny friend!',
      'Take these flowers. I have a plan for them...'
    ],
    rewards: [[B.FLOWER_PINK, 5], [B.FLOWER_YELLOW, 5], [B.FLOWER_BLUE, 5]]
  },
  {
    title: 'Bloom Town',
    giver: 'clover',
    offer: [
      'The village square looks a bit plain, do you not think?',
      'Let us fill it with flowers! Plant some around the square, wherever looks pretty.'
    ],
    goals: [
      { type: 'place', count: 8, near: 'VILLAGE', radius: 16, text: 'Plant flowers around the village',
        items: [B.FLOWER_PINK, B.FLOWER_YELLOW, B.FLOWER_BLUE, B.FLOWER_LILAC] }
    ],
    remind: 'Hold a flower and right click on the ground near the village square.',
    done: [
      'It is beautiful! The bees are going to be SO happy.',
      'These lilac flowers are very rare. And Pip asked me to pass you some lanterns!'
    ],
    rewards: [[B.FLOWER_LILAC, 8], [B.LANTERN, 6]]
  },
  {
    title: 'Lantern Trail',
    giver: 'pip',
    offer: [
      'Hi! I am Pip. I look after the lanterns.',
      'The fireflies have stopped visiting, because the village is too dark at night.',
      'Could you place some lanterns around the village and the pond? They will find their way back!'
    ],
    goals: [
      { type: 'place', count: 6, near: 'VILLAGE', radius: 28, items: [B.LANTERN], text: 'Place lanterns around the village and pond' }
    ],
    remind: 'Hold a lantern and right click to place it. Put them anywhere near the village.',
    done: [
      'Look, the sun is going down... wait for it...',
      'FIREFLIES! They came back! Now every evening will sparkle.'
    ],
    rewards: [[B.LANTERN, 4]],
    onComplete: 'fireflies'
  },
  {
    title: 'The Sleepy Ducklings',
    giver: 'pip',
    offer: [
      'Oh no, oh no. Three ducklings wandered off for a nap and forgot the way home!',
      'One went west into the woods, one went south to the beach, and one went east towards the hill.',
      'Click on a duckling and it will follow you. Please lead them back to the pond!'
    ],
    goals: [
      { type: 'event', event: 'duckHome', count: 3, text: 'Lead the lost ducklings back to the pond' }
    ],
    remind: 'Look for the bouncing yellow markers. West woods, south beach, and east by the hill.',
    done: [
      'They are all home! Listen to those happy little quacks.',
      'I think this one wants to stay with you. Ducklings know a good friend when they see one.'
    ],
    rewards: [[B.LANTERN, 2]],
    onStart: 'spawnDucklings',
    onComplete: 'duckPet'
  },
  {
    title: 'Bake Day',
    giver: 'honeybun',
    offer: [
      'Hello, sweet pea! I am baking a cake for the whole village.',
      'But my cupboard is empty! I need wheat from the field, an egg from a nest by the pond, and honey from a beehive in the trees.',
      'Bring them to me and there will be cake for everyone. Especially you.'
    ],
    goals: [
      { type: 'have', item: B.WHEAT, count: 3, text: 'Wheat from the field' },
      { type: 'have', item: B.EGG, count: 1, text: 'An egg from a nest by the pond' },
      { type: 'have', item: B.HONEY, count: 1, text: 'Honey from a beehive in a tree' }
    ],
    remind: 'The wheat field is west of the square. Nests sit beside the pond. Beehives hang under the leaves of some trees.',
    done: [
      'Mix, mix, mix... bake, bake, bake... DING!',
      'Cake for you! And look who followed the smell into my kitchen. This kitten needs a home.'
    ],
    take: [[B.WHEAT, 3], [B.EGG, 1], [B.HONEY, 1]],
    rewards: [[B.CAKE, 3]],
    onComplete: 'kitten'
  },
  {
    title: 'Crystal Cave',
    giver: 'hazel',
    offer: [
      'I have a secret. There is a cave in the big hill to the north-east, and inside it... something glows.',
      'I left a lantern by the entrance. You might have to dig a little.',
      'Bring back three glow crystals and I will trade you my most special building blocks.'
    ],
    goals: [
      { type: 'have', item: B.CRYSTAL, count: 3, text: 'Find glow crystals in the hill cave' }
    ],
    remind: 'The hill is north-east of the village. Look for my lantern at the cave entrance.',
    done: [
      'They are even prettier than I imagined! You keep them, they suit you.',
      'As promised: candy blocks! Pink, mint, lilac and lemon. Build something magical.'
    ],
    rewards: [[B.CANDY_PINK, 20], [B.CANDY_MINT, 20], [B.CANDY_LILAC, 20], [B.CANDY_LEMON, 20]]
  },
  {
    title: 'Pet Parade',
    giver: 'honeybun',
    offer: [
      'I have had the most wonderful idea. A PET PARADE!',
      'Bring three of your pets to the village square, all together, and we will celebrate.'
    ],
    goals: [
      { type: 'petsAt', count: 3, near: 'VILLAGE', radius: 12, text: 'Bring three pets to the village square' }
    ],
    remind: 'Your pets follow you, so just walk into the square with three of them. You can befriend more bunnies with berries.',
    done: [
      'Here they come! Oh, they are all so fluffy!',
      'Three cheers for our newest neighbour! Let the fireworks begin!'
    ],
    rewards: [[B.CAKE, 5], [B.LANTERN, 10]],
    onComplete: 'fireworks'
  }
];
