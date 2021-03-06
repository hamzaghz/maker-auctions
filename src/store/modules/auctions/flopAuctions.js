const BigNumber = require('bignumber.js')
const moment = require('moment')

const state = {
    flopAuctions: [],
    flopHistory: [],
    flopAuctionsInitialized: false,
}

const getters = {
    getFlopAuctions: (state) => (state.flopAuctions),
    getFlopHistory: (state) => (state.flopHistory),
    flopAuctionsInitialized: (state) => (state.flopAuctionsInitialized),
}

const actions = {
    setFlopAuctionsFromWS({ commit, rootState }, msg) {

        const parsedAuctions = []
        let parsedHistory = []

        if(msg.auctions) {
            Object.keys(msg.auctions).forEach(function(id) {
                parsedAuctions.push(makeAuctionFromRaw(rootState, id, msg.auctions[id]))
            })
        }

        if(msg.histories) {
            Object.keys(msg.histories).forEach(function(id) {
                parsedHistory.push(makeHistoryFromRaw(id, msg.histories[id]))
            })
        }
       
        for(let i = 0; i < parsedAuctions.length; i++) {

            let prev
            // Do we have a previous valid entry?
            for(let c = 0; c < state.flopAuctions.length; c++) {
                if(state.flopAuctions[c].id === parsedAuctions[i].id) {
                    prev = state.flopAuctions[c]
                    break
                }
            }

            if(prev) {
                parsedAuctions[i] = prev
            }
        }

        const append = []
        for(let i = 0; i < state.flopHistory.length; i++) {
            let found = false
            for(let c = 0; c < parsedHistory.length; c++) {
                if(state.flopHistory[i].id === parsedHistory[c].id) {
                    found = true
                    break
                }
            }

            if(found) {
                continue
            }

            append.push(state.flopHistory[i])
        }

        parsedHistory = parsedHistory.concat(...append)
        parsedHistory.sort((lhs, rhs) => {return parseInt(rhs.id) - parseInt(lhs.id)})

        parsedAuctions.sort((lhs, rhs) => {return parseInt(rhs.id) - parseInt(lhs.id)})

        commit('setFlopAuctionsInitialized', true)
        commit('setFlopAuctions', parsedAuctions)
        commit('setFlopHistory', parsedHistory)
    },

    setFlopHistoryFromWS({ commit, state }, msg) {
        let parsed = []

        Object.keys(msg.histories).forEach(function(id) {
            parsed.push(makeHistoryFromRaw(id, msg.histories[id]))
        })

        const append = []
        for(let i = 0; i < state.flopHistory.length; i++) {
            let found = false
            for(let c = 0; c < parsed.length; c++) {
                if(state.flopHistory[i].id === parsed[c].id) {
                    found = true
                    break
                }
            }

            if(found) {
                continue
            }

            append.push(state.flopHistory[i])
        }

        parsed = parsed.concat(...append)
        parsed.sort((lhs, rhs) => {return parseInt(rhs.id) - parseInt(lhs.id)})

        commit('setFlopHistory', parsed)
    },

    requestMoreFlopHistory({state, dispatch}) {

        const len = state.flopHistory.length
        if(len === 0) {
            return
        }

        const lastID = state.flopHistory[len - 1].id
        const msg = {
            topic: 'flopHistory',
            content: {
                lastID: parseInt(lastID),
            },
        }

        dispatch('wsSendMsg', JSON.stringify(msg))
    }
}

const mutations = {
    setFlopAuctions: (state, auctions) => (state.flopAuctions = auctions),
    setFlopHistory: (state, history) => (state.flopHistory = history),
    setFlopAuctionsInitialized: (state, b) => (state.flopAuctionsInitialized = b),
}

function makeAuctionFromRaw(rootState, id, raw) {

    if(!raw.isValid) {
        // Invalid. Check if initialized at least
        if(raw.lot === undefined) {
            return {
                id: id,
                phase: 'INV',
                raw: raw,
            }
        }
    }

    let amount = BigNumber(raw.lot).div(BigNumber(10).pow(rootState.contracts.mkr.decimals)).toFixed(2)
    let end
    if(parseInt(raw.end) < parseInt(raw.tic) || parseInt(raw.tic) === 0) {
        end = raw.end
    } else {
        end = raw.tic
    }

    return {
        id: id,
        phase: shortPhaseToLongPhase(raw.phase),
        amount: amount,
        bid: BigNumber(raw.bid).div(BigNumber(10).pow(45)).toFixed(4),
        bidder: raw.guy.substring(0, 6) + '...' + raw.guy.substring(raw.guy.length - 4),
        end: moment.unix(end).fromNow(),
        raw: {
            phase: raw.phase,
            lot: BigNumber(raw.lot),
            bid: BigNumber(raw.bid),
            usr: raw.usr,
            gal: raw.gal,
            guy: raw.guy,
            tic: raw.tic,
            end: raw.end,
            isValid: raw.isValid,
        },
    }
}

function makeHistoryFromRaw(id, raw) {

    const amount = BigNumber(raw.lot).div(BigNumber(10).pow(18)).toFixed(4)

    return {
        id: id,
        amount: amount,
        bid: BigNumber(raw.bid).div(BigNumber(10).pow(45)).toFixed(2),
        bidder: raw.guy.substring(0, 6) + '...' + raw.guy.substring(raw.guy.length - 4),
        end: moment.unix(parseInt(raw.end)).fromNow(),
        raw: {
            lot: BigNumber(raw.lot),
            bid: BigNumber(raw.bid),
            guy: raw.guy,
            end: raw.end,
        },
    }
}

function shortPhaseToLongPhase(phase) {
    switch(phase) {
        case 'RUN':
            return 'RUNNING'
        case 'RES':
            return 'RESTART'
        case 'FIN':
            return 'FINISHED'
        default:
            return 'INVALID'
    }
}

export default {
    state,
    getters,
    actions,
    mutations,
}