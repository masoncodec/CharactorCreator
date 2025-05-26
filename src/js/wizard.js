// ======================
// DATA STRUCTURES
// ======================

const MODULE_SYSTEM = {
    'high-fantasy': {
      name: 'High Fantasy',
      destinies: ['wizard', 'knight', 'rogue', 'cleric'],
      attributes: ['Strength', 'Dexterity', 'Constitution', 'Wisdom', 'Intelligence', 'Charisma'],
      descriptions: {
        module: 'Classic medieval fantasy adventuring with swords, sorcery, and epic quests.',
        destinies: {
          wizard: 'Arcane spellcaster who manipulates magical energies through rigorous study.',
          knight: 'Noble warrior sworn to protect the realm with martial prowess.',
          rogue: 'Stealthy opportunist who thrives in shadows and urban environments.',
          cleric: 'Divine agent who channels holy power to heal and smite.'
        }
      }
    },
    'crescendo': {
      name: 'Crescendo',
      destinies: ['pianist', 'guitarist', 'singer', 'drummer'],
      attributes: ['Passion', 'Rhythm', 'Stamina', 'Fame', 'Style', 'Harmony'],
      descriptions: {
        module: 'Musical storytelling game about fame, artistry, and creative struggles.',
        destinies: {
          pianist: 'Keyboard virtuoso with technical precision and emotional depth.',
          guitarist: 'String instrument master who commands the stage with riffs and solos.',
          singer: 'Vocal artist who connects with audiences through raw emotion.',
          drummer: 'Rhythmic backbone who drives the band\'s energy and tempo.'
        }
      }
    }
  };
  
  // Sub-change 1.1: FLAW_DATA structure - Removed id_name
  const FLAW_DATA = {
    'overconfidence': {
      name: 'Overconfidence',
      description: 'You underestimate threats',
      effect: 'Disadvantage on Perception vs danger'
    },
    'arrogance': {
      name: 'Arrogance',
      description: 'You believe you are superior to others',
      effect: 'Disadvantage on Charisma (Persuasion) checks with authority figures'
    },
    'code-of-honor': {
      name: 'Code of Honor',
      description: 'You refuse to fight dirty',
      effect: 'Cannot gain advantage from stealth attacks'
    },
    'naive-idealism': {
      name: 'Naive Idealism',
      description: 'You always expect the best from people',
      effect: 'Disadvantage on Wisdom (Insight) checks to detect deception'
    },
    'greed': {
      name: 'Greed',
      description: 'You can\'t resist valuable loot',
      effect: 'Disadvantage on resisting theft or bribery'
    },
    'recklessness': {
      name: 'Recklessness',
      description: 'You often act without thinking',
      effect: 'Disadvantage on Dexterity (Acrobatics) checks in dangerous situations'
    },
    'dogmatic': {
      name: 'Dogmatic',
      description: 'You strictly follow doctrine',
      effect: 'Cannot lie or deceive, and must always attempt to convert non-believers'
    },
    'zealotry': {
      name: 'Zealotry',
      description: 'Your faith is unshakeable, but blinding',
      effect: 'Cannot be convinced by non-religious arguments, and may become hostile towards opposing faiths'
    },
    'perfectionist': {
      name: 'Perfectionist',
      description: 'You obsess over mistakes',
      effect: 'Disadvantage on recovery checks after a failed performance'
    },
    'stage-fright': {
      name: 'Stage Fright',
      description: 'You struggle under pressure',
      effect: 'Disadvantage on Performance checks when alone on stage'
    },
    'ego': {
      name: 'Ego',
      description: 'You crave the spotlight',
      effect: 'Disadvantage on group performance checks, unless you are the primary focus'
    },
    'rivalry': {
      name: 'Rivalry',
      description: 'You see everyone as competition',
      effect: 'Cannot assist allies on Performance checks, and may challenge others unnecessarily'
    },
    'vulnerable': {
      name: 'Vulnerable',
      description: 'You take criticism hard',
      effect: 'Disadvantage on Fame checks after a failed performance'
    },
    'melodrama': {
      name: 'Melodrama',
      description: 'You exaggerate emotions for effect',
      effect: 'Disadvantage on Charisma (Deception) checks, as your intentions are often too obvious'
    },
    'impulsive': {
      name: 'Impulsive',
      description: 'You rush into things',
      effect: 'Disadvantage on patience or timing checks'
    },
    'distraction': {
      name: 'Distraction',
      description: 'You lose focus easily',
      effect: 'Disadvantage on concentration checks during lengthy performances'
    }
  };
  
  const DESTINY_DATA = {
    // ===== HIGH FANTASY DESTINIES =====
    'wizard': {
      displayName: 'Arcane Wizard',
      description: 'Master of magical energies through rigorous study.',
      health: {
        title: 'Frail',
        value: 6
      },
      flaws: ['overconfidence', 'arrogance'],
      tags: [
        { id: 'magic', display: 'Magic', color: '#8a2be2', icon: '🔮' },
        { id: 'support', display: 'Support', color: '#20b2aa', icon: '🌟' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'spellcaster' },
        { level: 3, ability: 'arcane-intellect' },
        { level: 5, ability: 'spell-mastery' }
      ]
    },
    'knight': {
      displayName: 'Chivalric Knight',
      description: 'Noble warrior sworn to protect the realm.',
      health: {
        title: 'Sturdy',
        value: 10
      },
      flaws: ['code-of-honor', 'naive-idealism'],
      tags: [
        { id: 'melee', display: 'Melee', color: '#b22222', icon: '⚔️' },
        { id: 'defense', display: 'Defense', color: '#1e90ff', icon: '🛡️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'armored-warrior' },
        { level: 3, ability: 'fealty' },
        { level: 5, ability: 'shield-bash' }
      ]
    },
    'rogue': {
      displayName: 'Shadow Rogue',
      description: 'Stealthy opportunist who thrives in shadows.',
      health: {
        title: 'Agile',
        value: 8
      },
      flaws: ['greed', 'recklessness'],
      tags: [
        { id: 'stealth', display: 'Stealth', color: '#696969', icon: '👤' },
        { id: 'trap', display: 'Traps', color: '#ff8c00', icon: '⚠️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'backstab' },
        { level: 3, ability: 'lockpick' },
        { level: 5, ability: 'poison-mastery' }
      ]
    },
    'cleric': {
      displayName: 'Divine Cleric',
      description: 'Holy warrior who channels divine power.',
      health: {
        title: 'Resilient',
        value: 9
      },
      flaws: ['dogmatic', 'zealotry'],
      tags: [
        { id: 'healing', display: 'Healing', color: '#32cd32', icon: '❤️' },
        { id: 'holy', display: 'Holy', color: '#ffd700', icon: '✝️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'divine-smite' },
        { level: 3, ability: 'lay-on-hands' },
        { level: 5, ability: 'turn-undead' }
      ]
    },
  
    // ===== CRESCENDO DESTINIES =====
    'pianist': {
      displayName: 'Virtuoso Pianist',
      description: 'Keyboard master with technical precision.',
      health: {
        title: 'Artistic',
        value: 7
      },
      flaws: ['perfectionist', 'stage-fright'],
      tags: [
        { id: 'keys', display: 'Keys', color: '#000000', icon: '🎹' },
        { id: 'solo', display: 'Solo', color: '#ffffff', icon: '🎼' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'virtuoso' },
        { level: 3, ability: 'improvisation' },
        { level: 5, ability: 'grand-finale' }
      ]
    },
    'guitarist': {
      displayName: 'Lead Guitarist',
      description: 'Stage-dominating riff machine.',
      health: {
        title: 'Charismatic',
        value: 8
      },
      flaws: ['ego', 'rivalry'],
      tags: [
        { id: 'strings', display: 'Strings', color: '#ff4500', icon: '🎸' },
        { id: 'lead', display: 'Lead', color: '#ffd700', icon: '🌟' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'power-chord' },
        { level: 3, ability: 'face-melter' },
        { level: 5, ability: 'feedback-loop' }
      ]
    },
    'singer': {
      displayName: 'Soulful Singer',
      description: 'Voice that moves audiences to tears.',
      health: {
        title: 'Emotive',
        value: 6
      },
      flaws: ['vulnerable', 'melodrama'],
      tags: [
        { id: 'vocals', display: 'Vocals', color: '#ff69b4', icon: '🎤' },
        { id: 'lyrics', display: 'Lyrics', color: '#9370db', icon: '📝' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'high-note' },
        { level: 3, ability: 'crowd-hush' },
        { level: 5, ability: 'golden-voice' }
      ]
    },
    'drummer': {
      displayName: 'Rhythmic Drummer',
      description: 'The band\'s heartbeat and tempo-keeper.',
      health: {
        title: 'Enduring',
        value: 9
      },
      flaws: ['impulsive', 'distraction'],
      tags: [
        { id: 'percussion', display: 'Percussion', color: '#8b4513', icon: '🥁' },
        { id: 'tempo', display: 'Tempo', color: '#0000ff', icon: '⏱️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'double-kick' },
        { level: 3, ability: 'fill-master' },
        { level: 5, ability: 'metronome-sense' }
      ]
    }
};
  
// Change 5: Address Inconsistency in Handling Ability Options (Strings vs. Objects)
const ABILITY_DATA = {
    // ===== HIGH FANTASY ABILITIES =====
    'spellcaster': {
      name: 'Spellcaster',
      type: ['Spell', 'Combat'],
      description: 'Choose ${maxChoices} spells from your spellbook.',
      maxChoices: 3,
      options: [ // Now objects with id, name, description
        { id: 'fireball', name: 'Fireball', description: 'A burst of flame that deals fire damage.' },
        { id: 'shield', name: 'Shield', description: 'Create a magical barrier.' },
        { id: 'mage-hand', name: 'Mage Hand', description: 'A spectral, floating hand.' },
        { id: 'lightning-bolt', name: 'Lightning Bolt', description: 'A streak of lightning that deals lightning damage.' }
      ],
      tier: 1
    },
    'arcane-intellect': {
      name: 'Arcane Intellect',
      type: ['Passive'],
      description: 'Learn spells from scrolls by spending ${cost.gold}.',
      cost: { gold: 50, item: 'spell-scroll' },
      tier: 2
    },
    'armored-warrior': {
      name: 'Armored Warrior',
      type: ['Combat', 'Passive'],
      description: 'Gain +${bonus} to Constitution when wearing heavy armor.',
      bonus: 3,
      tier: 1
    },
    'fealty': {
      name: 'Fealty',
      type: ['Social', 'Passive'],
      description: 'Advantage on Charisma checks in your lord\'s domain.',
      tier: 2
    },
    'backstab': {
      name: 'Backstab',
      type: ['Combat'],
      description: 'Deal ${damage}x damage when attacking from stealth.',
      damage: 2,
      cost: { stamina: 10 },
      tier: 1
    },
    'divine-smite': {
      name: 'Divine Smite',
      type: ['Holy', 'Combat'],
      description: 'Channel holy energy to deal ${damage} + WIS radiant damage.',
      damage: 5,
      cost: { faith: 1 },
      tier: 1
    },
    // New High Fantasy Abilities
    'spell-mastery': {
      name: 'Spell Mastery',
      type: ['Spell', 'Passive', 'Utility'],
      description: 'Gain powerful control over a chosen school of magic. Choose one school to specialize in.',
      tier: 5,
      maxChoices: 1,
      options: [
        {
          id: 'evocation-mastery',
          name: 'Evocation Mastery',
          description: 'Evocation spells deal an additional ${bonus} damage, and their area of effect increases by 5ft. Mana cost of Evocation spells reduced by 1.',
          bonus: 'INT' // Scales with Intelligence
        },
        {
          id: 'abjuration-mastery',
          name: 'Abjuration Mastery',
          description: 'Abjuration spells grant an additional ${bonus} temporary hit points. When casting an Abjuration spell, you gain +2 AC until your next turn. Mana cost of Abjuration spells reduced by 1.',
          bonus: 'INT' // Scales with Intelligence
        },
        {
          id: 'conjuration-mastery',
          name: 'Conjuration Mastery',
          description: 'Conjuration spells last an additional ${bonus} rounds. Summoned creatures gain +${bonus} to their attack rolls. Mana cost of Conjuration spells reduced by 1.',
          bonus: 'INT' // Scales with Intelligence
        }
      ],
      newResources: {
        'mana': {
          type: 'persistent',
          description: 'Arcane energy used to cast advanced spells. Refreshes on a long rest.'
        }
      }
    },
    'shield-bash': {
      name: 'Shield Bash',
      type: ['Combat', 'Utility'],
      description: 'Use your shield to stun an enemy, dealing ${damage} blunt damage. Target must succeed on a Constitution saving throw (DC 8 + STR modifier) or be Stunned for 1 round. Usable once per combat.',
      damage: '5 + STR', // Scales with Strength
      cost: { stamina: 15 },
      tier: 5,
      usage: 'once-per-combat',
      synergy: 'armored-warrior' // Synergizes with Armored Warrior
    },
    'lockpick': {
      name: 'Lockpick',
      type: ['Utility'],
      description: 'Expertly pick any non-magical lock with a successful Dexterity check (DC 10 + lock complexity). Can be used to disarm simple traps. You gain proficiency with Thieves\' Tools.',
      tier: 3,
      synergy: 'backstab' // Sets up opportunities for Backstab
    },
    'poison-mastery': {
      name: 'Poison Mastery',
      type: ['Utility', 'Combat'],
      description: 'You can craft ${maxChoices} unique poisons daily, choosing from a list. Applying a poison to a weapon takes a bonus action. Poisons inflict effects and ${bonus} necrotic damage. Your Backstab ability deals an additional 1x damage if the target is poisoned.',
      tier: 5,
      maxChoices: 2,
      options: [
        {
          id: 'paralytic-poison',
          name: 'Paralytic Poison',
          description: 'Target must succeed on a Constitution saving throw (DC 8 + DEX modifier) or be Paralyzed for 1 round.'
        },
        {
          id: 'wound-poison',
          name: 'Wound Poison',
          description: 'Target takes ${bonus} necrotic damage at the start of their turn for 3 rounds. Does not stack.'
        },
        {
          id: 'truth-serum',
          name: 'Truth Serum',
          description: 'Target becomes unable to lie for 1 minute. They must succeed on a Wisdom saving throw (DC 8 + CHA modifier) or truthfully answer any direct question.'
        }
      ],
      bonus: 'DEX', // Scales with Dexterity
      newResources: {
        'poison-vials': {
          type: 'temporary',
          description: 'Poisons crafted daily. Resets on a long rest.'
        }
      },
      synergy: 'backstab'
    },
    'lay-on-hands': {
      name: 'Lay on Hands',
      type: ['Healing', 'Support'],
      description: 'As an action, you can touch a creature and heal them for ${healing} hit points. Alternatively, you can expend 5 points to cure one disease or neutralize one poison affecting the creature. Your healing is boosted by your Wisdom.',
      healing: '5 + WIS * 2', // Scales with Wisdom (tiered: double WIS bonus)
      cost: { faith: 3 },
      tier: 3,
      usage: 'faith-points-based',
      newResources: {
        'faith-points': {
          type: 'persistent',
          description: 'Divine energy points. You have a pool equal to your Wisdom score. Refreshes on a long rest.'
        }
      }
    },
    'turn-undead': {
      name: 'Turn Undead',
      type: ['Holy', 'Utility', 'Combat'],
      description: 'As an action, present your holy symbol and speak a prayer. Each undead within 30 feet that can hear you must make a Wisdom saving throw (DC 8 + WIS modifier) or be Turned for 1 minute. A Turned creature must spend its turns trying to move as far away from you as it can. It cannot willingly move into a space within 30 feet of you. It also can\'t take reactions. For low-level undead (CR 1/2 or less), you can attempt to command them instead (Wisdom check vs their DC). Usable once per short rest.',
      tier: 5,
      cost: { faith: 2 },
      usage: 'once-per-short-rest',
      synergy: 'divine-smite' // Synergizes by controlling targets for Divine Smite
    },
  
    // ===== CRESCENDO ABILITIES =====
    'virtuoso': {
      name: 'Virtuoso',
      type: ['Performance', 'Passive'],
      description: 'Gain +${bonus} to technical skill checks.',
      bonus: 2,
      tier: 1
    },
    'improvisation': {
      name: 'Improvisation',
      type: ['Performance'],
      description: 'Reroll a failed performance check once per session.',
      cost: { inspiration: 1 },
      tier: 2
    },
    'power-chord': {
      name: 'Power Chord',
      type: ['Performance', 'Combat'],
      description: 'Deal ${damage} sonic damage to nearby enemies.',
      damage: 4,
      cost: { stamina: 15 },
      tier: 1
    },
    'high-note': {
      name: 'High Note',
      type: ['Performance'],
      description: 'Automatically succeed on a vocal check (once per session).',
      tier: 1
    },
    'double-kick': {
      name: 'Double Kick',
      type: ['Performance', 'Combat'],
      description: 'Gain an extra action during drum solos.',
      cost: { stamina: 20 },
      tier: 1
    },
    // New Crescendo Abilities
    'grand-finale': {
      name: 'Grand Finale',
      type: ['Performance', 'Utility'],
      description: 'Unleash a captivating musical climax. Choose one powerful finale effect to execute. Usable once per concert.',
      tier: 5,
      maxChoices: 1,
      options: [
        {
          id: 'emotional-crescendo',
          name: 'Emotional Crescendo',
          description: 'Inspire your allies. All allies within 30ft gain Advantage on their next attack roll or skill check within the next minute. Scales with Harmony.',
          scalesWith: 'Harmony' // Scales with Harmony
        },
        {
          id: 'shattering-climax',
          name: 'Shattering Climax',
          description: 'Deal ${damage} sonic damage to all enemies within 20ft. Scales with Passion.',
          damage: '8 + PASSION', // Scales with Passion
          type: 'Combat'
        },
        {
          id: 'encore-inducer',
          name: 'Encore Inducer',
          description: 'Significantly increase crowd "Hype" and Fame gain for this performance. You immediately gain 2 points of Fame. This effect is doubled if your current Fame is below 5. Scales with Fame.',
          scalesWith: 'Fame' // Scales with Fame
        }
      ],
      usage: 'once-per-concert',
      newResources: {
        'hype': {
          type: 'temporary',
          description: 'Represents audience engagement. Increases with good performances, decreases with poor ones. Resets per performance.'
        }
      }
    },
    'face-melter': {
      name: 'Face-Melter',
      type: ['Performance', 'Combat'],
      description: 'Unleash a blistering guitar solo that deals ${damage} psychic damage to a single target and forces them to make a Wisdom saving throw (DC 8 + STYLE modifier) or be Frightened for 1 round. Your style boosts this effect.',
      damage: '6 + STYLE', // Scales with Style
      cost: { stamina: 25 },
      tier: 3,
      usage: 'once-per-scene',
      synergy: 'power-chord' // Could lead into a Power Chord
    },
    'feedback-loop': {
      name: 'Feedback Loop',
      type: ['Performance', 'Utility', 'Combat'],
      description: 'Manipulate sonic feedback to your advantage. Choose one effect. The effectiveness is influenced by your Rhythm.',
      tier: 5,
      maxChoices: 1,
      options: [
        {
          id: 'disruptive-feedback',
          name: 'Disruptive Feedback',
          description: 'Create a cacophony that imposes Disadvantage on attack rolls for enemies within 15ft until the start of your next turn. Costs 1 Resonance Point.',
          cost: { resonance: 1 }
        },
        {
          id: 'empowering-feedback',
          name: 'Empowering Feedback',
          description: 'Amplify your own or an ally\'s next performance check, granting Advantage. Costs 1 Resonance Point.',
          cost: { resonance: 1 }
        },
        {
          id: 'defensive-feedback',
          name: 'Defensive Feedback',
          description: 'Generate a sonic barrier, granting you +${bonus} temporary hit points. Costs 1 Resonance Point.',
          bonus: 'RHYTHM', // Scales with Rhythm
          cost: { resonance: 1 }
        }
      ],
      newResources: {
        'resonance': {
          type: 'temporary',
          description: 'Points gained through successful musical attacks or sustained performance. Resets per combat/performance.'
        }
      },
      synergy: 'power-chord' // Can enhance or be enhanced by Power Chord
    },
    'crowd-hush': {
      name: 'Crowd Hush',
      type: ['Social', 'Performance'],
      description: 'Deliver a vocal performance so subtle and profound it captures the full attention of the audience. Gain Advantage on your next Charisma (Performance) check this scene. Silences minor distractions. Your Passion helps you silence the crowd.',
      tier: 3,
      cost: { inspiration: 1 },
      usage: 'once-per-scene',
      scalesWith: 'Passion'
    },
    'golden-voice': {
      name: 'Golden Voice',
      type: ['Social', 'Performance', 'Utility'],
      description: 'Your voice is imbued with irresistible charm and authority. Choose one powerful vocal effect. Usable once per session.',
      tier: 5,
      maxChoices: 1,
      options: [
        {
          id: 'commanding-aria',
          name: 'Commanding Aria',
          description: 'Issue a verbal command to a non-hostile creature. They must obey if the command is simple and does not endanger them (Wisdom saving throw DC 8 + CHA modifier to resist). Scales with Fame.',
          scalesWith: 'Fame'
        },
        {
          id: 'soothing-ballad',
          name: 'Soothing Ballad',
          description: 'Calm a hostile crowd or creature. Target must succeed on a Wisdom saving throw (DC 8 + CHA modifier) or become indifferent towards you for 1 minute. Scales with Passion.',
          scalesWith: 'Passion'
        },
        {
          id: 'inspiring-anthem',
          name: 'Inspiring Anthem',
          description: 'Rally up to 3 allies within 30ft. Each ally gains 1 Inspiration point. Scales with Style.',
          scalesWith: 'Style'
        }
      ],
      usage: 'once-per-session',
      newResources: {
        'inspiration-points': {
          type: 'temporary',
          description: 'Points reflecting creative energy or momentum, typically gained through roleplaying or successful performances. Resets per session.'
        }
      }
    },
    'fill-master': {
      name: 'Fill Master',
      type: ['Performance', 'Utility'],
      description: 'Execute a complex drum fill that can set up an ally or disrupt an enemy. Choose one effect. This requires precise Rhythm.',
      tier: 3,
      maxChoices: 1,
      options: [
        {
          id: 'setup-fill',
          name: 'Setup Fill',
          description: 'Grant an ally of your choice within 30ft Advantage on their next attack roll or performance check this turn. Costs 10 Stamina.',
          cost: { stamina: 10 }
        },
        {
          id: 'disruptive-fill',
          name: 'Disruptive Fill',
          description: 'Distract an enemy within 30ft, imposing Disadvantage on their next saving throw or attack roll. Costs 10 Stamina.',
          cost: { stamina: 10 }
        }
      ],
      scalesWith: 'Rhythm' // Scales with Rhythm
    },
    'metronome-sense': {
      name: 'Metronome Sense',
      type: ['Utility', 'Passive'],
      description: 'You possess an uncanny sense of rhythm and timing, allowing you to manipulate the flow of time in minor ways. Choose one application of your Metronome Sense. This ability makes you the ultimate tempo-keeper.',
      tier: 5,
      maxChoices: 1,
      options: [
        {
          id: 'perfect-timing',
          name: 'Perfect Timing',
          description: 'Once per session, you can reroll any failed Dexterity (Sleight of Hand) or Dexterity (Initiative) check. You have Advantage on checks to notice temporal anomalies. Scales with Rhythm.',
          scalesWith: 'Rhythm'
        },
        {
          id: 'tempo-control',
          name: 'Tempo Control',
          description: 'As an action, you can affect the speed of yourself or one willing ally within 30ft. They gain +5ft movement speed until the end of their next turn. Usable once per encounter. Scales with Stamina.',
          scalesWith: 'Stamina',
          usage: 'once-per-encounter'
        },
        {
          id: 'rhythmic-precognition',
          name: 'Rhythmic Precognition',
          description: 'You gain a momentary glimpse of the immediate future based on the rhythms around you. Once per short rest, you can ask the GM a "yes" or "no" question about the safest immediate course of action (e.g., "Is it safe to go through that door?"). Scales with Intelligence (if applicable for drummers, else Wisdom).',
          scalesWith: 'Intelligence' // or Wisdom, depending on how drummers perceive the world
        }
      ],
      newResources: {
        'flow-points': {
          type: 'temporary',
          description: 'Points representing your mastery over tempo. Gained through successful rhythmic actions. Resets per scene.'
        }
      }
    }
};

class CharacterWizard {
    constructor(db) {
      this.currentPage = 0;
      this.pages = ['module', 'destiny', 'attributes', 'info'];
      this.state = {
        module: null,
        moduleChanged: false, // This flag is still used for resetting destiny/attributes when module *truly* changes
        destiny: null,
        selectedFlaw: null, // New state for selected flaw
        abilities: [], // Track {id, selections, tier}
        attributes: {},
        info: { name: '', bio: '' }
      };
      this.db = db;
      this.navItems = document.querySelectorAll('.nav-item');
      
      console.log('CharacterWizard: Initializing wizard.');
      this.init();

      // Add validation call
      this.validateData();
    }
  
    init() {
      console.log('CharacterWizard.init: Setting up global event listeners.');
      this.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          if (item.classList.contains('disabled')) {
            console.log(`CharacterWizard.init: Navigation to page ${item.dataset.page} is disabled.`);
            return;
          }
          this.goToPage(item.dataset.page);
        });
      });
  
      document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
      document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());
  
      this.loadPage(this.pages[0]);
      console.log(`CharacterWizard.init: Initial page loaded: ${this.pages[0]}`);
    }
  
    loadPage(page) {
      this.currentPage = this.pages.indexOf(page);
      console.log(`CharacterWizard.loadPage: Loading page: ${page} (Index: ${this.currentPage})`);
      
      // Load selector content
      fetch(`partials/${page}-selector.html`)
        .then(r => {
            console.log(`CharacterWizard.loadPage: Fetched selector HTML for ${page}. Status: ${r.status}`);
            return r.text();
        })
        .then(html => {
          document.getElementById('selectorPanel').innerHTML = html;
          console.log(`CharacterWizard.loadPage: Selector panel for ${page} updated.`);
          // IMPORTANT: setupPageEvents must be called AFTER innerHTML is set to ensure DOM is ready.
          // For 'attributes', setupPageEvents will then call diceManager.init() which handles state restoration.
          this.setupPageEvents(page); 
          // restoreState is now primarily for other pages; attributes is handled by diceManager.init()
          this.restoreState(page); 
        })
        .catch(error => console.error(`CharacterWizard.loadPage: Error fetching selector partial for ${page}:`, error));
  
      // Load informer content
      fetch(`partials/${page}-informer.html`)
        .then(r => {
            console.log(`CharacterWizard.loadPage: Fetched informer HTML for ${page}. Status: ${r.status}`);
            return r.text();
        })
        .then(html => {
          document.getElementById('informerPanel').innerHTML = html;
          console.log(`CharacterWizard.loadPage: Informer panel for ${page} updated.`);
          this.updateInformer(page);
        })
        .catch(error => console.error(`CharacterWizard.loadPage: Error fetching informer partial for ${page}:`, error));
  
      this.updateNav();
    }
  
    // Navigation control
    updateNav() {
      console.log('CharacterWizard.updateNav: Updating navigation state and buttons.');
      this.navItems.forEach((item, index) => {
        const page = this.pages[index];
        const canAccess = this.canAccessPage(index);
        const isCompleted = this.isPageCompleted(page);

        item.classList.toggle('disabled', !canAccess);
        item.classList.toggle('active', index === this.currentPage);
        item.classList.toggle('completed', isCompleted); 
        
        if (!canAccess) {
          const reason = this.getNavigationBlockReason(index);
          item.title = reason;
          console.log(`CharacterWizard.updateNav: Page ${page} disabled. Reason: ${reason}`);
        } else {
          item.removeAttribute('title');
        }
      });
  
      document.getElementById('prevBtn').disabled = this.currentPage === 0;
      document.getElementById('nextBtn').textContent = 
        this.currentPage === this.pages.length - 1 ? 'Finish' : 'Next';
        console.log(`CharacterWizard.updateNav: Prev button disabled: ${document.getElementById('prevBtn').disabled}, Next button text: ${document.getElementById('nextBtn').textContent}`);
    }
  
    canAccessPage(index) {
        // Always allow access to the first page (module) and last page (info)
        if (index === 0 || index === this.pages.length - 1) {
            console.log(`CharacterWizard.canAccessPage: Page index ${index} is always accessible.`);
            return true;
        }
        
        // For other pages, require module selection
        if (!this.state.module) {
            console.log(`CharacterWizard.canAccessPage: Page index ${index} requires module selection. Current module: ${this.state.module}`);
            return false;
        }
        
        console.log(`CharacterWizard.canAccessPage: Page index ${index} is accessible.`);
        return true;
    }
  
    getNavigationBlockReason(index) {
        if (index === this.pages.length - 1) return "Enter basic details anytime"; 
        if (!this.state.module) return "Select a module first";
        return "";
    }
  
    // Page event setup
    setupPageEvents(page) {
      console.log(`CharacterWizard.setupPageEvents: Setting up events for page: ${page}`);
      switch(page) {
        case 'module':
          document.querySelectorAll('.module-option').forEach(opt => {
            opt.addEventListener('click', () => {
              document.querySelectorAll('.module-option').forEach(o => 
                o.classList.remove('selected'));
              opt.classList.add('selected');
              const oldModule = this.state.module;
              this.state.module = opt.dataset.value;
              this.state.moduleChanged = (oldModule !== this.state.module);
              if (this.state.moduleChanged) {
                  console.log(`CharacterWizard.setupPageEvents (module): Module changed from ${oldModule} to ${this.state.module}. Resetting destiny, flaw, and attributes.`);
                  this.state.destiny = null; // Reset dependent choices
                  this.state.selectedFlaw = null; // Reset selected flaw
                  this.state.abilities = []; // Reset abilities as well
                  this.state.attributes = {};
              } else {
                  console.log(`CharacterWizard.setupPageEvents (module): Module re-selected: ${this.state.module}. No change.`);
              }
              this.updateInformer(page);
              this.updateNav(); 
            });
          });
          break;
          
          case 'destiny':
            const roleSelect = document.getElementById('characterRole');
            roleSelect.innerHTML = '<option value="">Select a Destiny</option>';
          
            if (this.state.module) {
              MODULE_SYSTEM[this.state.module].destinies.forEach(destinyId => {
                const destiny = DESTINY_DATA[destinyId];
                if (!destiny) {
                    console.error(`Missing destiny data for: ${destinyId}`);
                    return;
                }
          
                const option = document.createElement('option');
                option.value = destinyId;
                option.textContent = destiny.displayName;
                roleSelect.appendChild(option);
              });
          
              if (this.state.destiny) {
                roleSelect.value = this.state.destiny;
              }
            }
          
            roleSelect.addEventListener('change', (e) => {
              this.state.destiny = e.target.value;
              this.state.abilities = []; // Reset on destiny change
              this.state.selectedFlaw = null; // Reset flaw on destiny change
              this.renderDestinyDetails(); // Render new flaw selection (Sub-change 1.3)
              this.renderAbilitiesSection(); // New method
              this.updateInformer(page); // Update informer (Sub-change 1.4)
              this.updateNav();
            });

            // Flaw selection listener for dynamically created select (Sub-change 1.3)
            // This listener is now attached within renderDestinyDetails to ensure it's on the correct element
            // after the element might have been re-rendered.
            break;
          
        case 'attributes':
            const tableContainer = document.getElementById('selectorPanel'); 
            let currentTable = tableContainer.querySelector('.dice-assignment-table');
            
            const previouslyRenderedModule = currentTable ? currentTable.dataset.renderedModule : null;
            const needsTableRefresh = !currentTable || (this.state.module && previouslyRenderedModule !== this.state.module);

            console.log(`CharacterWizard.setupPageEvents (attributes): Needs table refresh: ${needsTableRefresh}. Current Module: ${this.state.module}, Previously Rendered: ${previouslyRenderedModule}`);

            if (needsTableRefresh) {
                console.log('CharacterWizard.setupPageEvents (attributes): Re-rendering attribute table.');
                
                const newTable = document.createElement('table');
                newTable.classList.add('dice-assignment-table');
                newTable.dataset.renderedModule = this.state.module; 
                newTable.innerHTML = `
                    <thead>
                        <tr>
                            <th>Attribute</th>
                            <th colspan="6">Assign Die</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
                
                const newTableBody = newTable.querySelector('tbody');
                
                if (this.state.module) {
                    MODULE_SYSTEM[this.state.module].attributes.forEach(attr => {
                        const row = document.createElement('tr');
                        row.dataset.attribute = attr.toLowerCase();
                        row.innerHTML = `
                        <td>${attr}</td>
                        <td><button type="button" data-die="d4">D4</button></td>
                        <td><button type="button" data-die="d6">D6</button></td>
                        <td><button type="button" data-die="d8">D8</button></td>
                        <td><button type="button" data-die="d10">D10</button></td>
                        <td><button type="button" data-die="d12">D12</button></td>
                        <td><button type="button" data-die="d20">D20</button></td>
                        `;
                        newTableBody.appendChild(row);
                    });
                    console.log(`CharacterWizard.setupPageEvents (attributes): Attribute rows generated for module: ${this.state.module}`);
                } else {
                    console.log('CharacterWizard.setupPageEvents (attributes): No module selected, cannot generate attributes table.');
                }

                if (currentTable) {
                    currentTable.replaceWith(newTable);
                    console.log('CharacterWizard.setupPageEvents (attributes): Replaced existing table with new one.');
                } else {
                    tableContainer.appendChild(newTable); 
                    console.log('CharacterWizard.setupPageEvents (attributes): Appended new table to selector panel.');
                }
                currentTable = newTable; 
                
                this.state.moduleChanged = false; 
            } else {
                console.log('CharacterWizard.setupPageEvents (attributes): Attribute table does not need re-rendering. Module is unchanged or table exists.');
            }
            
            const diceManager = {
                wizard: this,
                selectedDice: new Map(), 
                assignedAttributes: new Map(), 
                tableElement: currentTable, // Crucial: Pass the reference to the current table
                
                init() {
                    console.log('diceManager.init: Initializing/re-initializing dice manager.');
                    this.selectedDice.clear();
                    this.assignedAttributes.clear();
        
                    this.tableElement.querySelectorAll('button').forEach(btn => { // Use this.tableElement
                        btn.classList.remove('selected');
                        btn.disabled = false;
                        btn.textContent = btn.dataset.die.toUpperCase(); 
                    });
                    
                    console.log('diceManager.init: Restoring previous attribute assignments from wizard state:', this.wizard.state.attributes);
                    Object.entries(this.wizard.state.attributes).forEach(([attr, die]) => {
                        this.selectedDice.set(die, attr);
                        this.assignedAttributes.set(attr, die);
                        const btn = this.tableElement.querySelector(`tr[data-attribute="${attr}"] button[data-die="${die}"]`); // Use this.tableElement
                        if (btn) {
                            btn.classList.add('selected');
                            console.log(`diceManager.init: Restored UI selection for ${attr} with ${die}.`);
                        }
                    });
                
                    // Ensure only one event listener is active on the correct table
                    if (this.boundProcessSelection) {
                        this.tableElement.removeEventListener('click', this.boundProcessSelection);
                    }
                    // Bind 'this' context for the event listener
                    this.boundProcessSelection = this.handleTableClick.bind(this);
                    this.tableElement.addEventListener('click', this.boundProcessSelection);
                    console.log('diceManager.init: Event listener attached to dice assignment table.');
                
                    this.updateDieStates();
                    console.log('diceManager.init: Dice manager initialized.');
                },

                // New method to handle the click event from the table
                handleTableClick(e) {
                    const button = e.target.closest('button[data-die]');
                    if (!button) return;
            
                    const row = button.closest('tr');
                    const attribute = row.dataset.attribute;
                    const die = button.dataset.die;
                    
                    this.processSelection(attribute, die, button);
                },
        
                processSelection(attribute, die, button) {
                    const currentAssignmentForAttribute = this.assignedAttributes.get(attribute);
                    console.log(`diceManager.processSelection: Processing selection for attribute '${attribute}'. Current assignment: ${currentAssignmentForAttribute || 'None'}. New selection: ${die}.`);
                    
                    if (currentAssignmentForAttribute === die) {
                        console.log(`diceManager.processSelection: Unassigning ${die} from ${attribute}.`);
                        this.clearAssignment(attribute, die);
                        button.classList.remove('selected');
                    } else {
                        if (this.selectedDice.has(die)) {
                            const assignedToAttr = this.selectedDice.get(die);
                            console.warn(`diceManager.processSelection: Die ${die} is already assigned to ${assignedToAttr}. Blocking selection.`);
                            alert(`This die type (${die.toUpperCase()}) is already assigned to ${assignedToAttr.charAt(0).toUpperCase() + assignedToAttr.slice(1)}`);
                            return;
                        }
        
                        if (currentAssignmentForAttribute) {
                            console.log(`diceManager.processSelection: Clearing previous assignment (${currentAssignmentForAttribute}) for attribute ${attribute}.`);
                            this.clearAssignment(attribute, currentAssignmentForAttribute);
                        }
        
                        console.log(`diceManager.processSelection: Assigning ${die} to ${attribute}.`);
                        this.selectedDice.set(die, attribute);
                        this.assignedAttributes.set(attribute, die);
                        button.classList.add('selected');
                    }
        
                    this.updateDieStates();
                    this.updateState();
                    this.wizard.updateNav();
                },
        
                clearAssignment(attribute, die) {
                    console.log(`diceManager.clearAssignment: Clearing assignment of die ${die} from attribute ${attribute}.`);
                    this.selectedDice.delete(die);
                    this.assignedAttributes.delete(attribute);
                    const btn = this.tableElement.querySelector(`tr[data-attribute="${attribute}"] button[data-die="${die}"]`); // Use this.tableElement
                    if (btn) btn.classList.remove('selected');
                },
        
                updateDieStates() {
                    console.log('diceManager.updateDieStates: Updating disabled states of die buttons.');
                    this.tableElement.querySelectorAll('button[data-die]').forEach(button => { // Use this.tableElement
                        const die = button.dataset.die;
                        const rowAttribute = button.closest('tr').dataset.attribute;
                        const currentAssignment = this.assignedAttributes.get(rowAttribute);
                        
                        const shouldBeDisabled = !(currentAssignment === die || !this.selectedDice.has(die));
                        button.disabled = shouldBeDisabled;
                        button.textContent = die.toUpperCase();
                    });
                },
        
                updateState() {
                    this.wizard.state.attributes = Object.fromEntries(this.assignedAttributes);
                    console.log('diceManager.updateState: Wizard state attributes updated:', this.wizard.state.attributes);
                }
            };
            
            diceManager.init();
            break;
          
        case 'info':
          document.getElementById('characterName').addEventListener('input', (e) => {
            this.state.info.name = e.target.value;
            console.log(`CharacterWizard.setupPageEvents (info): Character name updated: "${this.state.info.name}"`);
            this.updateNav(); 
          });
          document.getElementById('characterBio').addEventListener('input', (e) => {
            this.state.info.bio = e.target.value;
            console.log(`CharacterWizard.setupPageEvents (info): Character bio updated: "${this.state.info.bio}"`);
            this.updateNav(); 
          });
          break;
      }
    }
  
    // Informer updates (Sub-change 1.4: Refactor Destiny Information Display in Informer)
    updateInformer(page) {
      const informer = document.getElementById('informerPanel');
      if (!informer) {
        console.warn('CharacterWizard.updateInformer: Informer panel not found.');
        return;
      }
      console.log(`CharacterWizard.updateInformer: Updating informer for page: ${page}`);
  
      switch(page) {
        case 'module':
          informer.innerHTML = this.state.module 
            ? `<div class="module-info">
                 <h3>${MODULE_SYSTEM[this.state.module].name}</h3>
                 <p>${MODULE_SYSTEM[this.state.module].descriptions.module}</p>
                 <h4>Available Destinies:</h4>
                 <ul>
                   ${MODULE_SYSTEM[this.state.module].destinies.map(d => `<li>${DESTINY_DATA[d]?.displayName || d}</li>`).join('')}
                 </ul>
               </div>`
            : '<div class="module-info"><p>Select a module to begin your journey</p></div>';
            console.log(`CharacterWizard.updateInformer (module): Informer content updated for module: ${this.state.module || 'None selected'}`);
          break;
  
          case 'destiny':
            if (!this.state.destiny) {
              informer.innerHTML = '<p>Select your destiny</p>';
              return;
            }
            
            const destiny = DESTINY_DATA[this.state.destiny];
            const selectedFlaw = FLAW_DATA[this.state.selectedFlaw]; // Retrieve selected flaw details

            informer.innerHTML = `
              <div class="destiny-info">
                <h3>${destiny.displayName}</h3>
                <p>${destiny.description}</p>
                <div class="stats">
                  <div><strong>Health:</strong> ${destiny.health.title} (${destiny.health.value})</div>
                </div>
                <div class="tags">${this.renderTags(destiny.tags)}</div>
                ${selectedFlaw ? `
                  <div class="flaw-info">
                    <h4>Selected Flaw: ${selectedFlaw.name}</h4>
                    <p>${selectedFlaw.description}</p>
                    <p>Effect: ${selectedFlaw.effect}</p>
                  </div>
                ` : '<p>Select a flaw for your character from the options on the left.</p>'}
              </div>
            `;
            break;
  
        case 'attributes':
          informer.innerHTML = `
            <div class="attributes-info">
              <h3>${MODULE_SYSTEM[this.state.module]?.name || 'Module'} Attributes</h3>
              <p>Assign dice to your attributes:</p>
              <ul>
                ${this.state.module 
                  ? MODULE_SYSTEM[this.state.module].attributes.map(a => 
                      `<li><strong>${a}</strong>: ${this.state.attributes[a.toLowerCase()] || 'Unassigned'}</li>`
                    ).join('')
                  : 'Select a module first'}
              </ul>
            </div>`;
            console.log(`CharacterWizard.updateInformer (attributes): Informer content updated. Current assignments:`, this.state.attributes);
          break;
  
        case 'info':
          // Keep existing info informer - assuming it's static HTML content
          console.log('CharacterWizard.updateInformer (info): Informer content for info page is static.');
          break;
      }
    }

    // === NEW METHODS FOR ABILITIES SYSTEM ===
    // Sub-change 1.3: Integrate flaws with selector code (UI & State)
    renderDestinyDetails() {
        if (!this.state.destiny) {
            const existing = document.querySelector('.destiny-details');
            if (existing) existing.remove(); // Remove if no destiny selected
            return;
        }
        const destiny = DESTINY_DATA[this.state.destiny];
        
        const container = document.createElement('div');
        container.className = 'destiny-details';
        container.innerHTML = `
          <div class="flaw-selection">
            <label for="characterFlaw">Choose Your Flaw:</label>
            <select id="characterFlaw">
              <option value="">Select a Flaw</option>
              ${destiny.flaws.map(flawId => {
                const flaw = FLAW_DATA[flawId]; // Access flaw data directly by ID (key)
                if (!flaw) {
                    console.warn(`Missing flaw data for ID: ${flawId}`);
                    return '';
                }
                return `<option value="${flawId}" ${this.state.selectedFlaw === flawId ? 'selected' : ''}>
                          ${flaw.name} - ${flaw.description}
                        </option>`;
              }).join('')}
            </select>
          </div>
        `;
  
        let existing = document.querySelector('.destiny-details');
        if (existing) {
            existing.replaceWith(container);
        } else {
            // Find the location where destiny-details should be appended.
            // This is usually below the destiny role selection.
            const roleSelect = document.getElementById('characterRole');
            if (roleSelect) {
                roleSelect.parentNode.insertBefore(container, roleSelect.nextSibling);
            } else {
                document.querySelector('#selectorPanel').appendChild(container); // Fallback
            }
        }

        // Re-attach event listener if the select element was re-rendered
        const flawSelect = document.getElementById('characterFlaw');
        if (flawSelect) {
          flawSelect.addEventListener('change', (e) => {
            this.state.selectedFlaw = e.target.value;
            this.updateInformer('destiny'); // Update informer with selected flaw
            this.updateNav();
          });
        }
    }
  
    renderTags(tags) {
        return tags.map(tag => `
          <span class="tag" style="background: ${tag.color}">
            ${tag.icon} ${tag.display}
          </span>
        `).join('');
    }
  
    renderAbilitiesSection() {
        if (!this.state.destiny) {
            const existing = document.querySelector('.abilities-section');
            if (existing) existing.remove();
            return;
        }

        const destiny = DESTINY_DATA[this.state.destiny];
        
        const container = document.createElement('div');
        container.className = 'abilities-section';
        container.innerHTML = '<h4>Abilities</h4>';
  
        const abilitiesByTier = {};
        destiny.levelUnlocks.forEach(unlock => {
          if (!abilitiesByTier[unlock.level]) {
            abilitiesByTier[unlock.level] = [];
          }
          abilitiesByTier[unlock.level].push(unlock.ability);
        });
  
        Object.entries(abilitiesByTier).forEach(([tier, abilityIds]) => {
          container.innerHTML += `<h5 class="tier-header">Tier ${tier} (Choose 1)</h5>`;
          
          abilityIds.forEach(abilityId => { // abilityId is the correct string ID, e.g., 'spellcaster'
            const ability = ABILITY_DATA[abilityId]; // This is the definition object
            if (!ability) {
              console.warn(`Missing ability: ${abilityId}`);
              return;
            }
  
            const abilityState = this.state.abilities.find(a => a.id === abilityId);
            const isSelected = !!abilityState; // Check if the ability itself is selected
  
            container.innerHTML += `
              <div class="ability ${isSelected ? 'selected' : ''}" data-ability-id="${abilityId}">
                <div class="ability-header">
                  <label>
                    <input type="radio" name="tier-${tier}" 
                           ${isSelected ? 'checked' : ''}
                           data-tier="${tier}" 
                           data-ability="${abilityId}">
                    <span class="ability-name">${ability.name}</span>
                  </label>
                  <div class="ability-types">
                    ${ability.type.map(type => `
                      <span class="type-tag">${this.getTypeIcon(type)} ${type}</span>
                    `).join('')}
                  </div>
                </div>
                <div class="ability-description">${this.renderAbilityDescription(ability)}</div>
                ${ability.options ? this.renderAbilityOptions(ability, abilityId) : ''}
              </div>
            `;
          });
        });
  
        const existing = document.querySelector('.abilities-section');
        existing ? existing.replaceWith(container) : document.querySelector('#selectorPanel').appendChild(container);
        
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            this.handleTierSelection(
              e.target.dataset.tier, 
              e.target.dataset.ability
            );
          });
        });
  
        container.querySelectorAll('.ability-option input').forEach(checkbox => {
          checkbox.addEventListener('change', (e) => {
            this.handleAbilityOptionSelection(
              e.target.dataset.ability, // This will now be the correct abilityId
              e.target.dataset.option,
              e.target.checked,
              e.target // Pass the checkbox element itself
            );
          });
        });

        // Ensure all ability option states are refreshed after rendering
        this.refreshAbilityOptionStates(); 
    }
  
    getTypeIcon(type) {
        const icons = {
          'Combat': '⚔️',
          'Spell': '🔮',
          'Support': '🛡️',
          'Social': '💬',
          'Holy': '✨',
          'Healing': '❤️',
          'Performance': '🎤',
          'Utility': '🛠️',
          'Passive': '⭐'
        };
        return icons[type] || '✨';
    }

    renderAbilityDescription(ability) {
        let desc = ability.description;
        // Replace template variables like ${attribute} or ${cost.gold} etc.
        desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
            let value;
            try {
                // Attempt to resolve nested properties (e.g., 'cost.gold')
                const path = p1.split('.');
                let current = ability;
                for (let i = 0; i < path.length; i++) {
                    if (current === null || current === undefined) {
                        current = undefined; // Path does not exist
                        break;
                    }
                    current = current[path[i]];
                }
                value = current;
    
                // If the value is still undefined, try direct property (e.g., 'bonus')
                if (value === undefined && typeof ability[p1] !== 'undefined') {
                    value = ability[p1];
                }
            } catch (e) {
                console.error(`Error resolving template variable ${p1}:`, e);
                value = undefined;
            }
    
            if (value !== undefined) {
                // --- NEW LOGIC TO APPEND UNITS ---
                if (p1 === 'cost.gold' && typeof value === 'number') {
                    return `${value} gold`; // Appends " gold" if it's a numeric cost.gold
                }
                // --- END NEW LOGIC ---
    
                // If value is a string (e.g., 'INT', '5 + STR'), return it as is.
                // Otherwise, return the interpolated value.
                return value;
            }
            return match; // Return original placeholder if value not found
        });
        return desc;
    }
  
    renderAbilityOptions(ability, abilityId) {
        if (!ability.options) return '';
        
        const abilityState = this.state.abilities.find(a => a.id === abilityId);
        const currentSelections = abilityState ? abilityState.selections : [];
        const isParentAbilityCurrentlySelected = !!abilityState; // Check if the parent ability is in the state

        return `
        <div class="ability-options">
            <p>Choose ${ability.maxChoices || 'any'}:</p>
            ${ability.options.map(option => `
            <label class="ability-option">
                <input type="checkbox"
                    ${currentSelections.some(s => s.id === option.id) ? 'checked' : ''}
                    data-ability="${abilityId}"
                    data-option="${option.id}"
                    ${!isParentAbilityCurrentlySelected ? 'disabled' : ''} // Initially disable if parent is not selected
                >
                ${option.name}: ${this.renderAbilityDescription(option)}
            </label>
            `).join('')}
        </div>
        `;
    }
  
    handleTierSelection(tier, abilityId) {
        console.log(`CharacterWizard.handleTierSelection: Handling selection for Tier ${tier}, Ability: ${abilityId}`);
        // First, create a new array excluding any existing ability from this specific tier.
        // This ensures only one ability per tier is active in the state.
        this.state.abilities = this.state.abilities.filter(ability => {
            return ability.tier !== parseInt(tier); // Keep abilities that are NOT from the current tier
        });

        // Now, add the newly selected ability for this tier.
        this.state.abilities.push({
            id: abilityId,
            tier: parseInt(tier),
            selections: [] // Reset selections for the newly chosen ability in this tier
        });
        console.log(`CharacterWizard.handleTierSelection: State after update:`, this.state.abilities);
        
        // After updating state, refresh all ability option states globally to reflect changes
        this.refreshAbilityOptionStates(); 

        this.updateNav();
    }
    
    // Modified handleAbilityOptionSelection function
    handleAbilityOptionSelection(abilityId, optionId, isSelected, checkboxElement) {
        const abilityState = this.state.abilities.find(a => a.id === abilityId);
        if (!abilityState) {
            console.warn(`CharacterWizard.handleAbilityOptionSelection: Parent ability '${abilityId}' not found in state.`);
            // If parent ability is not selected, this option should ideally be disabled anyway.
            // As a fallback for direct interaction, ensure it's unchecked if clicked
            checkboxElement.checked = false;
            this.refreshAbilityOptionStates(); // Re-sync UI
            return;
        }
    
        const abilityDef = ABILITY_DATA[abilityId];
        
        if (isSelected) {
            // Check maxChoices before adding
            if (abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null && abilityState.selections.length >= abilityDef.maxChoices) {
                checkboxElement.checked = false; // Revert checkbox state
                alert(`You can only select up to ${abilityDef.maxChoices} option(s) for ${abilityDef.name}.`);
                this.refreshAbilityOptionStates(); // Ensure UI is consistent after alert
                return; 
            }
            // Add option if not already present
            if (!abilityState.selections.some(s => s.id === optionId)) {
                abilityState.selections.push({ id: optionId });
            }
        } else {
            // Remove option
            abilityState.selections = abilityState.selections.filter(s => s.id !== optionId);
        }
    
        // After state update, refresh the disabled status of ALL checkboxes globally
        this.refreshAbilityOptionStates(); 
        this.updateInformer('destiny'); 
    }
  
    // Sub-change 1.3: Update validateDestinyCompletion to check for selectedFlaw
    validateDestinyCompletion() {
        if (!this.state.destiny) return false;
        const destiny = DESTINY_DATA[this.state.destiny];
        
        // Check if a flaw is selected
        if (!this.state.selectedFlaw) {
          console.log("Validation: No flaw selected.");
          return false;
        }

        // Check at least one ability per tier is selected
        const tiers = [...new Set(destiny.levelUnlocks.map(u => u.level))];
        const tierComplete = tiers.every(tier => {
          return this.state.abilities.some(a => 
            destiny.levelUnlocks.some(u => u.level == tier && u.ability === a.id)
          );
        });
        console.log("Validation: All tiers completed:", tierComplete);
  
        // Check ability option requirements
        const optionsComplete = this.state.abilities.every(abilityState => {
          const abilityDef = ABILITY_DATA[abilityState.id];
          if (!abilityDef.options) return true; // No options to choose from
          if (abilityDef.maxChoices === undefined || abilityDef.maxChoices === null) return true; // No explicit maxChoices, so any number is fine
          
          return abilityState.selections.length === abilityDef.maxChoices;
        });
        console.log("Validation: All ability options complete:", optionsComplete);
  
        return tierComplete && optionsComplete && !!this.state.selectedFlaw;
    }
  
    // New method to check if a page is truly completed
    isPageCompleted(page) {
        let completed = false;
        switch(page) {
            case 'module':
                completed = !!this.state.module;
                break;
            case 'destiny':
                return this.validateDestinyCompletion();
            case 'attributes':
                if (!this.state.module) {
                    completed = false;
                } else {
                    const requiredAttrs = MODULE_SYSTEM[this.state.module].attributes;
                    // A page is completed if all required attributes have a die assigned
                    completed = requiredAttrs.every(attr => 
                        this.state.attributes[attr.toLowerCase()]
                    );
                }
                break;
            case 'info':
                completed = !!this.state.info.name?.trim(); 
                break;
            default:
                completed = false;
        }
        console.log(`CharacterWizard.isPageCompleted: Page '${page}' is completed: ${completed}. State:`, JSON.parse(JSON.stringify(this.state)));
        return completed;
    }

    // Navigation methods
    goToPage(page) {
      const pageIndex = this.pages.indexOf(page);
      if (pageIndex !== -1) { 
        console.log(`CharacterWizard.goToPage: Navigating to page: ${page}`);
        this.loadPage(page);
      } else {
        console.warn(`CharacterWizard.goToPage: Attempted to go to unknown page: ${page}`);
      }
    }
  
    nextPage() {
      if (this.currentPage < this.pages.length - 1) {
        const nextPageName = this.pages[this.currentPage + 1];
        console.log(`CharacterWizard.nextPage: Moving to next page: ${nextPageName}`);
        this.loadPage(nextPageName);
      } else {
        console.log('CharacterWizard.nextPage: End of wizard, attempting to finish.');
        this.finishWizard();
      }
    }
  
    prevPage() {
      if (this.currentPage > 0) {
        const prevPageName = this.pages[this.currentPage - 1];
        console.log(`CharacterWizard.prevPage: Moving to previous page: ${prevPageName}`);
        this.loadPage(prevPageName);
      } else {
        console.log('CharacterWizard.prevPage: Already on the first page, cannot go back further.');
      }
    }
  
    // Validation system (kept for final submission, but not enforced during navigation)
    validateCurrentPage() {
      // This method is now only called by finishWizard() to provide a final summary of missing fields.
      // It no longer prevents navigation.
      console.log('CharacterWizard.validateCurrentPage: This method is deprecated for navigation control, only for final validation summary.');
      return true;
    }

    validateData() {
        Object.keys(MODULE_SYSTEM).forEach(moduleId => {
          MODULE_SYSTEM[moduleId].destinies.forEach(destinyId => {
            if (!DESTINY_DATA[destinyId]) {
              console.error(`Missing destiny data for: ${destinyId}`);
            } else {
              // Validate flaws
              DESTINY_DATA[destinyId].flaws.forEach(flawId => {
                if (!FLAW_DATA[flawId]) {
                  console.error(`Missing flaw data: ${flawId} for destiny ${destinyId}`);
                }
              });

              DESTINY_DATA[destinyId].levelUnlocks.forEach(unlock => {
                if (!ABILITY_DATA[unlock.ability]) {
                  console.error(`Missing ability data: ${unlock.ability} for destiny ${destinyId}`);
                }
              });
            }
          });
        });
    }
  
    showPageError() {
      const errorMap = {
        module: { 
          element: '.module-options', 
          message: 'Please select a module to continue' 
        },
        destiny: { 
          element: '#characterRole', 
          message: 'Please select a destiny and a flaw for your character, and ensure all ability options are selected.' 
        },
        attributes: { 
          element: '.dice-assignment-table', 
          message: 'Please assign dice to all attributes' 
        },
        info: { 
          element: '#characterName', 
          message: 'Please enter your character\'s name' 
        }
      };
  
      const currentPageName = this.pages[this.currentPage];
      const { element, message } = errorMap[currentPageName];
      const el = document.querySelector(element);
      if (el) {
        el.classList.add('error-highlight');
        setTimeout(() => {
            el.classList.remove('error-highlight');
            console.log(`CharacterWizard.showPageError: Removed error highlight from ${element}`);
        }, 2000);
      }
      console.error(`CharacterWizard.showPageError: Displaying error for page '${currentPageName}': ${message}`);
      alert(message);
    }
  
    // Final validation and completion
    validateAllPages() {
      console.log('CharacterWizard.validateAllPages: Running final validation across all pages.');
      const errors = [];
      
      if (!this.state.module) {
        errors.push("• Please select a Module");
        console.log('  - Validation error: Module not selected.');
      } else {
        if (!this.state.destiny) {
          errors.push("• Please select a Destiny");
          console.log('  - Validation error: Destiny not selected.');
        } else {
            // Validate flaw selection
            if (!this.state.selectedFlaw) {
                errors.push("• Please select a Flaw for your character.");
                console.log('  - Validation error: Flaw not selected.');
            }

            // Validate ability selections and their options
            const destiny = DESTINY_DATA[this.state.destiny];
            const tiers = [...new Set(destiny.levelUnlocks.map(u => u.level))];
            tiers.forEach(tier => {
                const tierAbilities = destiny.levelUnlocks.filter(u => u.level === tier).map(u => u.ability);
                const selectedAbilityInTier = this.state.abilities.find(a => tierAbilities.includes(a.id));
                if (!selectedAbilityInTier) {
                    errors.push(`• Please select an Ability for Tier ${tier}.`);
                    console.log(`  - Validation error: No ability selected for Tier ${tier}.`);
                } else {
                    const abilityDef = ABILITY_DATA[selectedAbilityInTier.id];
                    if (abilityDef.options && abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null) {
                        if (selectedAbilityInTier.selections.length !== abilityDef.maxChoices) {
                            errors.push(`• Please select exactly ${abilityDef.maxChoices} option(s) for the ability "${abilityDef.name}".`);
                            console.log(`  - Validation error: Incorrect number of options for ability "${abilityDef.name}".`);
                        }
                    }
                }
            });
        }
        
        const requiredAttrs = MODULE_SYSTEM[this.state.module].attributes;
        const missingAttrs = requiredAttrs.filter(attr => 
          !this.state.attributes[attr.toLowerCase()]
        );
        
        if (missingAttrs.length > 0) {
          errors.push(`• Assign dice to: ${missingAttrs.join(', ')}`);
          console.log('  - Validation error: Missing attribute assignments:', missingAttrs);
        }
      }
      
      if (!this.state.info.name?.trim()) {
        errors.push("• Please enter a Character Name");
        console.log('  - Validation error: Character name is empty.');
      }
      
      return {
        isValid: errors.length === 0,
        message: errors.join("\n")
      };
    }
  
    finishWizard() {
      console.log('CharacterWizard.finishWizard: Attempting to finish wizard.');
      const validation = this.validateAllPages();
      
      if (!validation.isValid) {
        console.warn('CharacterWizard.finishWizard: Validation failed. Showing errors.');
        alert("Please complete the following:\n\n" + validation.message);
        return;
      }
  
      const character = {
        name: this.state.info.name,
        module: this.state.module,
        destiny: this.state.destiny,
        selectedFlaw: this.state.selectedFlaw, // Save the selected flaw
        attributes: this.state.attributes,
        bio: this.state.info.bio,
        health: { current: DESTINY_DATA[this.state.destiny].health.value,
            max: DESTINY_DATA[this.state.destiny].health.value,
            temporary: 0 },
        inventory: [],
        abilities: this.state.abilities, // Save the full abilities array with selections
        createdAt: new Date().toISOString()
      };
      console.log('CharacterWizard.finishWizard: Character object prepared for saving:', character);
  
      this.db.saveCharacter(character)
        .then(() => {
          console.log('CharacterWizard.finishWizard: Character saved successfully. Redirecting to character-selector.html');
          window.location.href = 'character-selector.html';
        })
        .catch(err => {
          console.error('CharacterWizard.finishWizard: Failed to save character:', err);
          alert(`Failed to save character: ${err.message}`);
        });
    }
  
    // State restoration for elements outside diceManager's direct control
    restoreState(page) {
        console.log(`CharacterWizard.restoreState: Restoring state for page: ${page}`);
        switch(page) {
            case 'module':
                if (this.state.module) {
                    const btn = document.querySelector(`.module-option[data-value="${this.state.module}"]`);
                    if (btn) {
                        btn.classList.add('selected');
                        console.log(`CharacterWizard.restoreState (module): Module option "${this.state.module}" re-selected.`);
                    }
                }
                break;
                
            case 'destiny':
                const roleSelect = document.getElementById('characterRole');
                if (this.state.destiny) {
                    if (roleSelect) {
                        roleSelect.value = this.state.destiny;
                        console.log(`CharacterWizard.restoreState (destiny): Destiny dropdown set to "${this.state.destiny}".`);
                    }
                    this.renderDestinyDetails(); 
                    this.renderAbilitiesSection(); 
                    console.log(`CharacterWizard.restoreState (destiny): Re-rendered destiny details and abilities section to reflect stored abilities selections.`);

                    const flawSelect = document.getElementById('characterFlaw');
                    if (flawSelect && this.state.selectedFlaw) {
                        flawSelect.value = this.state.selectedFlaw;
                        console.log(`CharacterWizard.restoreState (destiny): Flaw dropdown set to "${this.state.selectedFlaw}".`);
                    }
                    this.refreshAbilityOptionStates(); // Ensure option states are correct after rendering and state restoration
                } else {
                    if (roleSelect) {
                        roleSelect.value = ""; 
                    }
                    const destinyDetailsContainer = document.querySelector('.destiny-details');
                    if (destinyDetailsContainer) destinyDetailsContainer.remove(); 
                    
                    const abilitiesSectionContainer = document.querySelector('.abilities-section');
                    if (abilitiesSectionContainer) abilitiesSectionContainer.remove(); 
                    console.log(`CharacterWizard.restoreState (destiny): No destiny in state. Cleared destiny details and abilities section.`);
                    this.refreshAbilityOptionStates(); // Also refresh to clear any lingering UI state if destiny was cleared
                }
                break;
                
            case 'attributes':
                // diceManager.init() now handles full restoration for attributes
                console.log('CharacterWizard.restoreState (attributes): DiceManager handles attribute state restoration.');
                break; 
                
            case 'info':
                const charNameInput = document.getElementById('characterName');
                const charBioInput = document.getElementById('characterBio');
                if (charNameInput) {
                    charNameInput.value = this.state.info.name || '';
                    console.log(`CharacterWizard.restoreState (info): Character name input set to "${this.state.info.name}".`);
                }
                if (charBioInput) {
                    charBioInput.value = this.state.info.bio || '';
                    console.log(`CharacterWizard.restoreState (info): Character bio input set to "${this.state.info.bio}".`);
                }
                break;
        }
    }

    refreshAbilityOptionStates() {
        console.log('CharacterWizard.refreshAbilityOptionStates: Updating all ability option disabled states. Current state.abilities:', this.state.abilities);
        // CHANGE THIS LINE: Select .ability instead of .ability-container
        document.querySelectorAll('.ability').forEach(abilityContainer => {
            const abilityId = abilityContainer.dataset.abilityId;
            const abilityData = ABILITY_DATA[abilityId];
            
            // Find if this ability is selected in the wizard's state
            const abilityState = this.state.abilities.find(a => a.id === abilityId);
            const isParentAbilityCurrentlySelected = !!abilityState; // True if abilityId is in state.abilities
            console.log(`  Ability Container: ${abilityId}, isParentAbilityCurrentlySelected: ${isParentAbilityCurrentlySelected}`);
    
            const optionsContainer = abilityContainer.querySelector('.ability-options');
            // Proceed only if options container exists and ability data defines options
            if (optionsContainer && abilityData && abilityData.options) {
                optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(optionCheckbox => {
                    const optionId = optionCheckbox.dataset.option;
                    // Check if this specific option is selected in the state
                    const isOptionSelected = abilityState ? abilityState.selections.some(s => s.id === optionId) : false;
    
                    let shouldBeDisabled = false;
    
                    if (!isParentAbilityCurrentlySelected) {
                        shouldBeDisabled = true;
                        // If the parent ability is NOT selected, ensure the option is unchecked and disabled
                        if (optionCheckbox.checked) {
                            optionCheckbox.checked = false;
                            // Also clean up the state if for some reason this option was still selected
                            if (abilityState) {
                                abilityState.selections = abilityState.selections.filter(s => s.id !== optionId);
                            }
                            console.log(`    Option '${optionId}': Unchecked and disabled because parent not selected.`);
                        } else {
                            console.log(`    Option '${optionId}': Disabled because parent not selected.`);
                        }
                    } else {
                        // Parent ability IS selected, now apply maxChoices logic
                        const currentSelectionsCount = abilityState.selections.length;
                        const maxChoices = abilityData.maxChoices;
    
                        // If maxChoices is defined and reached, disable options that are NOT currently selected
                        if (maxChoices !== undefined && maxChoices !== null && currentSelectionsCount >= maxChoices && !isOptionSelected) {
                            shouldBeDisabled = true;
                            console.log(`    Option '${optionId}': Disabling because max choices (${maxChoices}) reached and not selected.`);
                        } else {
                            // This is the case where the option should be enabled
                            console.log(`    Option '${optionId}': Enabling (parent selected, max choices not reached or is selected).`);
                        }
                    }
                    optionCheckbox.disabled = shouldBeDisabled; // Apply the final disabled state
                });
            }
        });
        this.updateNav();
    }
}
  
document.addEventListener('DOMContentLoaded', () => {
    if (typeof db === 'undefined') {
      console.error("CharacterWizard: Database module 'db' not loaded! Ensure db.js is included before wizard.js.");
      return;
    }
    console.log('CharacterWizard: DOMContentLoaded event fired. Initializing CharacterWizard with db.');
    new CharacterWizard(db);
});