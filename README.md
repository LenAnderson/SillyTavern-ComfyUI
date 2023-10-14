# SillyTavern - ComfyUI Extension

Generate background images, character images etc. using ComfyUI.

I simply copied the "Stable Diffusion" extension that comes with SillyTavern and adjusted it to use ComfyUI.

Should have the all the features that the Stable Diffusion extension offers.

Slash command is `/comfy` (e.g. `/comfy background` or `/comfy apple`).




## ⚠️ **WARNING** ⚠️

**Consider this an alpha version / proof of concept.**

Expect bugs.




## Installation

Use ST's inbuilt extension installer.




## Usage

Settings can be found here:

- Extensions > ComfyUI
- Extensions > ComfyUI Prompt Templates

What you need to do:

- Start ComfyUI with the command line argument `--enable-cors-header http://127.0.0.1:8000` (if your SillyTavern is not at http://127.0.0.1:8000 then adjust that part of the argument accordingly).  
The full command may now look something like this: `.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --enable-cors-header http://127.0.0.1:8000`
- Save the workflow that you want to use as a JSON file
- Open the JSON file in a text editor and replace the following values with placeholders:
	- positive prompt -> `%prompt%`
	- negative prompt -> `%negative_prompt%`
	- sampler -> `%sampler%`
	- steps -> `%steps%`
	- scale -> `%scale%`
	- width -> `%width%`
	- height -> `%height%`
- Copy the contents of the modified JSON file into the "ComfyUI Workflow" textbox in StableDiffusion