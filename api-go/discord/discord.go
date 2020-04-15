package discord

import (
	"fmt"
	"math/big"

	"../global"
	"../parsers/flapparser"
	"../parsers/flipparser"
	"../parsers/flopparser"
	"github.com/bwmarrin/discordgo"
)

var (
	// FlipETHChan is the channel for flip eth kick updates
	FlipETHChan chan flipparser.KickEvent
	// FlipBATChan is the channel for flip bat kick updates
	FlipBATChan chan flipparser.KickEvent
	// FlipUSDCChan is the channel for flip usdc kick updates
	FlipUSDCChan chan flipparser.KickEvent

	// FlapChan is the channel for flap kick updates
	FlapChan chan flapparser.KickEvent

	// FlopChan is the channel for flap kick updates
	FlopChan chan flopparser.KickEvent

	discord *discordgo.Session
)

// Run starts the discord bot
func Run() {
	FlipETHChan = make(chan flipparser.KickEvent)
	FlipBATChan = make(chan flipparser.KickEvent)
	FlipUSDCChan = make(chan flipparser.KickEvent)
	FlapChan = make(chan flapparser.KickEvent)
	FlopChan = make(chan flopparser.KickEvent)

	var err error
	discord, err = discordgo.New(fmt.Sprintf("Bot %s", global.GetDiscordKey()))
	if err != nil {
		panic(err)
	}

	go func() {
		for {
			select {
			case auction := <-FlipETHChan:
				handleNewFlipAuction("ETH", auction)
			case auction := <-FlipBATChan:
				handleNewFlipAuction("BAT", auction)
			case auction := <-FlipUSDCChan:
				handleNewFlipAuction("USDC", auction)
			case auction := <-FlapChan:
				handleNewFlapAuction(auction)
			case auction := <-FlopChan:
				handleNewFlopAuction(auction)
			}
		}
	}()
}

func handleNewFlipAuction(token string, auction flipparser.KickEvent) {
	msg := fmt.Sprintf(`**New flip auction available**

ID: %d     |     Amount: %s %s     |     Max Bid: %s DAI     |     Current Bid: %s DAI `,
		auction.ID,
		convertBN(auction.Lot, 18),
		token,
		convertBN(auction.Tab, 45),
		convertBN(auction.Bid, 45))

	_, err := discord.ChannelMessageSend(global.GetDiscordChannelID(), msg)
	if err != nil {
		panic(err)
	}
}

func handleNewFlapAuction(auction flapparser.KickEvent) {
	msg := fmt.Sprintf(`**New flap auction available**

ID: %d     |     Amount: %s DAI     |     Current Bid: %s MKR`,
		auction.ID,
		convertBN(auction.Lot, 45),
		convertBN(auction.Bid, 18))

	_, err := discord.ChannelMessageSend(global.GetDiscordChannelID(), msg)
	if err != nil {
		panic(err)
	}
}

func handleNewFlopAuction(auction flopparser.KickEvent) {
	msg := fmt.Sprintf(`**New flop auction available**

ID: %d     |     Amount: %s MKR     |     Current Bid: %s DAI`,
		auction.ID,
		convertBN(auction.Lot, 18),
		convertBN(auction.Bid, 45))

	_, err := discord.ChannelMessageSend(global.GetDiscordChannelID(), msg)
	if err != nil {
		panic(err)
	}
}

func convertBN(num string, decimals uint64) string {
	bn, ok := new(big.Float).SetString(num)
	if !ok {
		panic("could not convert bn-string to bn")
	}

	pow := new(big.Float).SetInt(new(big.Int).Exp(new(big.Int).SetUint64(10), new(big.Int).SetUint64(decimals), nil))
	return new(big.Float).Quo(bn, pow).String()
}
