/**
 * KnightForge opening seed dataset.
 * Seed dataset — 16 classical openings for study.
 * ECO codes and move sequences are factual chess knowledge.
 * Idea texts are original descriptions written for KnightForge.
 * No statistics (win rates, popularity) are included anywhere.
 */

export type OpeningTag =
  | 'e4'
  | 'd4'
  | 'flank'
  | 'defense'
  | 'open'
  | 'closed'
  | 'aggressive'
  | 'beginner'

export interface Opening {
  id: string
  name: string
  eco: string
  /** SAN move line, space separated */
  moves: string
  ideas: string
  tags: OpeningTag[]
}

export const OPENING_TAGS: OpeningTag[] = [
  'e4',
  'd4',
  'flank',
  'defense',
  'open',
  'closed',
  'aggressive',
  'beginner',
]

export const OPENINGS_DATASET_LABEL = 'Seed dataset — 16 classical openings for study'

export const OPENINGS: Opening[] = [
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    eco: 'C60',
    moves: 'e4 e5 Nf3 Nc6 Bb5',
    ideas:
      'White pressures the e5 pawn indirectly by pinning the knight that defends it. The bishop on b5 eyes a future c6 trade that would double Black pawns, and White often builds a slow queenside bind. Black has many healthy setups, making this one of the deepest openings in chess.',
    tags: ['e4', 'open', 'defense'],
  },
  {
    id: 'italian-game',
    name: 'Italian Game',
    eco: 'C50',
    moves: 'e4 e5 Nf3 Nc6 Bc4',
    ideas:
      'The bishop targets the sensitive f7 square while White keeps a flexible pawn structure. Classic plans include a quick c3 and d4 to grab the center, or a slower c3-d3 build-up with piece play. It is an ideal first opening because the plans are transparent and principled.',
    tags: ['e4', 'open', 'beginner'],
  },
  {
    id: 'sicilian-defense',
    name: 'Sicilian Defense',
    eco: 'B20',
    moves: 'e4 c5',
    ideas:
      'Black fights for the center from the side rather than mirroring White, creating an unbalanced game. The c5 pawn trades on d4 and leaves Black with a half-open c-file for counterplay. It is the most combative reply to 1.e4 and leads to sharp, dynamic positions.',
    tags: ['e4', 'defense', 'aggressive'],
  },
  {
    id: 'french-defense',
    name: 'French Defense',
    eco: 'C00',
    moves: 'e4 e6',
    ideas:
      'Black prepares to challenge e4 with d5 behind a solid pawn chain. The light-squared bishop can be cramped early, but Black builds a rock-solid structure and attacks the center with c5 after d4. Games are typically strategic with clear pawn-chain play on both sides.',
    tags: ['e4', 'defense', 'closed'],
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann Defense',
    eco: 'B10',
    moves: 'e4 c6',
    ideas:
      'Black supports the d7-d5 break with the c-pawn so the light-squared bishop keeps a free path after ...d5xe4. The structure is sturdy and Black rarely gets worse out of the opening. White gains space and natural development, so precise middlegame plans matter.',
    tags: ['e4', 'defense', 'beginner'],
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    eco: 'D06',
    moves: 'd4 d5 c4',
    ideas:
      'White offers the c-pawn to deflect Black from holding the center with d5. If Black captures, White cannot win the pawn back immediately but gains long-term pressure on the center. It is the classical way to fight for 1.d4 superiority and teaches core pawn-structure ideas.',
    tags: ['d4', 'closed', 'beginner'],
  },
  {
    id: 'kings-indian',
    name: "King's Indian Defense",
    eco: 'E60',
    moves: 'd4 Nf6 c4 g6',
    ideas:
      'Black concedes the center at first and builds a fortress with g6, Bg7 and d6. Once White expands with e4 or c5, Black strikes with ...e5 or ...c5 to blow up the middle. The result is often a race: White attacks on one wing while Black storms the other.',
    tags: ['d4', 'defense', 'closed'],
  },
  {
    id: 'london-system',
    name: 'London System',
    eco: 'D02',
    moves: 'd4 d5 Bf4',
    ideas:
      'White sidesteps theory by developing the bishop outside the pawn chain before e3. The signature setup is Bf4, e3, c3, Nf3, Bd3 and Nbd2, a compact pyramid that is hard to attack. Plans revolve around a well-timed e4 break or queenside pressure after c4.',
    tags: ['d4', 'beginner', 'closed'],
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian Defense',
    eco: 'B01',
    moves: 'e4 d5 exd5 Qxd5',
    ideas:
      'Black meets e4 with an immediate central strike and recaptures with the queen. The queen invites a tempo-gaining Nc3, after which Black retreats and completes development with simple moves. Play becomes quick and concrete, which suits players who like to skip deep theory.',
    tags: ['e4', 'defense', 'aggressive'],
  },
  {
    id: 'pirc-defense',
    name: 'Pirc Defense',
    eco: 'B07',
    moves: 'e4 d6 d4 Nf6',
    ideas:
      'Black lets White build a big center with pawns on d4 and e4, then undermines it. The plan is g6, Bg7 and timely ...e5 or ...c5 hits, using the fianchettoed bishop as the star piece. White often plays a large-space setup, making positions sharp and double-edged.',
    tags: ['e4', 'defense', 'closed'],
  },
  {
    id: 'english-opening',
    name: 'English Opening',
    eco: 'A10',
    moves: 'c4',
    ideas:
      'White stakes out d5 from the flank and keeps the pawn structure elastic. Systems often transpose into reversed Sicilians where White is a tempo up, or into pure flank play with g3 and Bg2. It rewards planning over memorization, which is why strategy lovers favor it.',
    tags: ['flank', 'closed'],
  },
  {
    id: 'reti-opening',
    name: 'Réti Opening',
    eco: 'A05',
    moves: 'Nf3 d5 c4',
    ideas:
      'White develops first and pressures d5 with the c-pawn while delaying the central pawn commitments. The hypermodern idea is to let Black occupy the center, then strike it with c4, e4 or b4 at the right moment. Flexibility is the theme: almost every setup remains available.',
    tags: ['flank', 'beginner'],
  },
  {
    id: 'vienna-game',
    name: 'Vienna Game',
    eco: 'C25',
    moves: 'e4 e5 Nc3',
    ideas:
      'White defends the e4 pawn with the knight, keeping the option of f4 for an early kingside attack. Unlike the King\'s Knight line, the f1 bishop stays free for a strong Bc4 or even Bd3. Black must react accurately to avoid falling behind on development.',
    tags: ['e4', 'open', 'aggressive'],
  },
  {
    id: 'ponziani',
    name: 'Ponziani Opening',
    eco: 'C44',
    moves: 'e4 e5 Nf3 Nc6 c3',
    ideas:
      'White prepares d4 with pawn support, trying to build the ideal e4-and-d4 center. The tempo spent on c3 lets Black grab the initiative with moves like ...d5 or ...Nf6 at the right moment. It is a little-studied classical line that can catch unprepared opponents off guard.',
    tags: ['e4', 'open', 'beginner'],
  },
  {
    id: 'four-knights',
    name: 'Four Knights Game',
    eco: 'C47',
    moves: 'e4 e5 Nf3 Nc6 Nc3',
    ideas:
      'Both sides develop knights toward the center in the most natural, symmetrical way. The opening is famous for being safe and sound, with the main strategic tension arriving after 4...Bb4 or 4...Nf6. It is a classic teaching ground for development-counting and piece-activity principles.',
    tags: ['e4', 'open', 'beginner'],
  },
  {
    id: 'dutch-defense',
    name: 'Dutch Defense',
    eco: 'A80',
    moves: 'd4 f5',
    ideas:
      'Black stakes a claim on e4 with the f-pawn and builds an aggressive kingside presence. The wedge on f5 unbalances the game immediately, steering toward a Leningrad, Stonewall or Classical setup. It is a fighting choice for players who want a win with Black rather than a gradual equalize.',
    tags: ['d4', 'defense', 'aggressive'],
  },
]

export const OPENINGS_BY_ID: Record<string, Opening> = Object.fromEntries(
  OPENINGS.map((o) => [o.id, o]),
)
