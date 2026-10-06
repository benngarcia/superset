import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const aboutFile = path.join(process.cwd(), "content/about.mdx");

export const aboutSchema = z.object({
	photoCaption: z.string().min(1),
	photos: z.array(
		z.object({
			src: z.string().min(1),
			alt: z.string().min(1),
			caption: z.string().min(1),
		}),
	),
	investors: z.array(
		z.object({
			name: z.string().min(1),
			detail: z.string().optional(),
			href: z.string().optional(),
		}),
	),
	principles: z.array(
		z.object({
			title: z.string().min(1),
			body: z.string().min(1),
			author: z.string().min(1),
			date: z.coerce.date(),
		}),
	),
	timeline: z.array(
		z.object({
			date: z.coerce.date(),
			title: z.string().min(1),
			href: z.string().optional(),
		}),
	),
});

export type About = z.infer<typeof aboutSchema>;

export function getAbout(): About {
	const { data } = matter(fs.readFileSync(aboutFile, "utf-8"));
	return aboutSchema.parse(data);
}
