"""Fit the rig's standing spine/leg ratio before skinning, with a smooth transition at the axilla."""
def shape(x,y,z):
    hip=.9979
    if y<.077:return [x,y,z]
    if y<hip:
        knee=.5471
        knee_shift=.015*min(1,(y-.077)/(knee-.077),(hip-y)/(hip-knee))
        return [x,.077+(y-.077)*.944-knee_shift,z]
    shoulder=1.475
    def torso(h):return .077+(hip-.077)*.944+(min(h,shoulder)-hip)*1.16+max(0,h-shoulder)
    u=min(1,max(0,(abs(x)-.14)/.12))
    u=u*u*(3-2*u)
    return [x,torso(y)*(1-u)+(torso(shoulder)+y-shoulder)*u,z]

if __name__=='__main__':
    import json
    from pathlib import Path
    studio=Path(__file__).resolve().parents[1]
    bones=json.loads((studio/'assets/asset.json').read_text())['skeleton']
    for bone in bones:
        for key in ['head','tail']:bone[key]=shape(*bone[key])
    (studio.parent/'.cache/court-studio/rest.json').write_text(json.dumps(bones))
