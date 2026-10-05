const STYLE = "bottts";

const PARAMS = [
	"scale=1.05",
	"headVariant=round01,round02,square01,square02,square03,square04",
	"eyesVariant=happy,hearts,eva,round,roundFrame01,roundFrame02,bulging",
	"mouthVariant=smile01,smile02,bite,square01",
	"topProbability=100",
	"topVariant=antenna,antennaCrooked,bulb01,horns,radar,lights",
	"sidesProbability=100",
	"sidesVariant=antenna01,antenna02,round,square,cables01",
	"textureProbability=0",
	"backgroundColor=17232d,232037,172a25,302219,2b1e2a",
	"baseColor=83c9e8,b7a0ed,89d4af,f4ba80,ee9cb0,f1d77e",
].join("&");

export function avatarUrl(handle: string): string {
	return `https://api.dicebear.com/10.x/${STYLE}/svg?${PARAMS}&seed=${encodeURIComponent(handle.toLowerCase())}`;
}
