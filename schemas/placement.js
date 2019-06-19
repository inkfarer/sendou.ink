const { UserInputError, gql } = require('apollo-server-express')
const Placement = require('../models/placement')
const Player = require('../models/player')

const typeDef = gql`
  extend type Query {
    topPlayers (weapon: String!): topPlayer!
    playerInfo(uid: String twitter: String): PlayerWithPlacements!
    searchForPlayers(name: String! exact: Boolean): [Placement]!
  }
  type Placement {
    id: ID!
    name: String!
    weapon: String!
    rank: Int!
    mode: Int!
    x_power: Float!
    unique_id: String!
    month: Int!
    year: Int!
  }
  type topPlayer {
    placements: [Placement!]!
    modeCount: [Int!]!
  }
  type PlayerWithPlacements {
    player: Player!
    placements: [Placement!]!
  }
`
const resolvers = {
  Query: {
    topPlayers: async (root, args) => {
      const placements =  await Placement
        .find({ weapon: args.weapon })
        .sort({ "x_power": "desc" })
        .select({ weapon: 0})
        .catch(e => {
          throw new UserInputError(e.message, {
            invalidArgs: args,
          })
        })
      
      const m = placements.reduce((acc, cur) => {
        if (cur.mode === 1) {
          acc.sz++
        } else if (cur.mode === 2) {
          acc.tc++
        } else if (cur.mode === 3) {
          acc.rm++
        } else {
          acc.cb++
        }

        return acc
      }, {sz: 0, tc: 0, rm: 0, cb: 0})

      return {placements: placements.slice(0, 101), modeCount: [m.sz+m.tc+m.rm+m.cb, m.sz, m.tc, m.rm, m.cb]}
    },
    playerInfo: async (root, args) => {
      let searchCriteria = {}
      if (args.uid) searchCriteria = { "unique_id": args.uid }
      else if (args.twitter) searchCriteria = { "twitter": args.twitter.toLowerCase()}
      else throw new UserInputError('no id or twitter provided', {
        invalidArgs: args,
      })
      const player = await Player
        .findOne(searchCriteria)
        .catch(e => {
          throw new UserInputError(e.message, {
            invalidArgs: args,
          })
        })

      if (!player) {
        throw new UserInputError('player not found', {
          invalidArgs: args,
        })
      }
      const placements = await Placement
        .find({ unique_id: player.unique_id })
        .sort({ "year": "asc", "month": "asc" })
        .catch(e => {
          throw new UserInputError(e.message, {
            invalidArgs: args,
          })
        })

      return { player, placements }
    },
    searchForPlayers: async (root, args) => {
      let placements = []
      if (args.exact) {
        placements = await Placement
          .find({ name: args.name })
          .sort({ "x_power": "desc" })
          .limit(100)
          .select({ name: 1, weapon: 1, x_power: 1, unique_id: 1})
          .catch(e => {
            throw new UserInputError(e.message, {
              invalidArgs: args,
            })
          })
      } else {
        placements = await Placement
          .find({ name: { "$regex": args.name, "$options": "i" }})
          .sort({ "x_power": "desc" })
          .limit(100)
          .select({ name: 1, weapon: 1, x_power: 1, unique_id: 1})
          .catch(e => {
            throw new UserInputError(e.message, {
              invalidArgs: args,
            })
          })
        }

      let uids = []

      return placements.filter(p => {
        if (uids.length === 21) {
          return false
        }
        const bool = uids.includes(p.unique_id)
        if (bool) {
          return false
        }
        uids.push(p.unique_id)
        return true
      })
    }
  }
}

module.exports = {
  Placement: typeDef,
  placementResolvers: resolvers
}