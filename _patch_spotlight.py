import io

c = 'frontend/static/css/main.css'
css = io.open(c, encoding='utf-8').read()

old_stage = """.playlist-stage {
  display: flex;
  justify-content: flex-start;
  overflow: hidden;
  padding: 6px 0 4px;
}
.playlist-track {
  display: flex;
  gap: 14px;
  transition: transform 0.6s ease;
}
.playlist-track .menu-card {
  width: 220px;
  flex: 0 0 220px;
}"""
new_stage = """/* Grey-bordered 1-product spotlight viewport */
.playlist-stage {
  display: flex;
  justify-content: flex-start;
  overflow: hidden;
  width: 220px;
  max-width: 220px;
  border: 1.5px solid var(--border, #3a3a3a);
  border-radius: 16px;
  padding: 0;
  margin: 6px 0 4px;
}
.playlist-track {
  display: flex;
  gap: 0;
  transition: transform 0.6s ease;
}
.playlist-track .menu-card {
  width: 220px;
  flex: 0 0 220px;
}"""
assert old_stage in css, 'stage block not found'
css = css.replace(old_stage, new_stage, 1)

old_mobile = """@media (max-width: 600px) {
  .playlist-track .menu-card {
    width: 170px;
    flex: 0 0 170px;
  }"""
new_mobile = """@media (max-width: 600px) {
  .playlist-stage {
    width: 170px;
    max-width: 170px;
  }
  .playlist-track .menu-card {
    width: 170px;
    flex: 0 0 170px;
  }"""
assert old_mobile in css, 'mobile block not found'
css = css.replace(old_mobile, new_mobile, 1)

io.open(c, 'w', encoding='utf-8', newline='').write(css)
print('spotlight viewport css applied')
