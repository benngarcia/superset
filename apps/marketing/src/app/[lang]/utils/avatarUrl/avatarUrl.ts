const STYLE = "voxel-bot";

const PARAMS = [
 "scale=1.15",
 "topProbability=100",
 "chestVariant=vents,screen,heart,dial,slot",
 "backgroundColor=17232d,232037,172a25,302219,2b1e2a",
 "bodyColor=7db9d8,c089e8,7bc9a8,e2a36f,d88b9c,9ea6ef",
 "accentColor=3a546b,614c7a,3c685a,815b3c,724756",
 "screenColor=111821",
 "glowColor=7ee7e0,ffcb6b,b5ed83,e7a5ef",
].join("&");

export function avatarUrl(handle: string): string {
	return `https://api.dicebear.com/10.x/${STYLE}/svg?${PARAMS}&seed=${encodeURIComponent(handle.toLowerCase())}`;
}
