import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
D=Path(__file__).parent
TL=json.load(open(D/"tl.json"))
html=(D/"ari.html").read_text().replace("__TL__",json.dumps(TL))
(D/"ari_built.html").write_text(html)
async def main(times, outdir, fps=None):
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg=await br.new_page(viewport={"width":1080,"height":1920})
        await pg.goto("file://"+str(D/"ari_built.html")); await pg.evaluate("document.fonts.ready")
        Path(outdir).mkdir(exist_ok=True)
        for k,t in enumerate(times):
            await pg.evaluate(f"render({t})")
            await pg.screenshot(path=f"{outdir}/f{k:05d}.jpg", type="jpeg", quality=88)
        await br.close()
if sys.argv[1]=="test":
    ts=[s["start"]+s["dur"]*0.7 for s in TL["segs"]]
    asyncio.run(main(ts,"test"))
else:
    fps=30; n=int(TL["total"]*fps)
    asyncio.run(main([k/fps for k in range(n)],"frames"))
