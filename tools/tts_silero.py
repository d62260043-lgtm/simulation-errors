import sys, torch, soundfile as sf

text = open(sys.argv[1], encoding='utf-8').read()
out = sys.argv[2]
speaker = sys.argv[3] if len(sys.argv) > 3 else 'baya'

device = torch.device('cpu')

# ВАЖНО: trust_repo=True говорит torch.hub не задавать вопрос про доверие
model, _ = torch.hub.load(
    repo_or_dir='snakers4/silero-models', 
    model='silero_tts', 
    language='ru', 
    speaker='v4_ru',
    trust_repo=True 
)
model.to(device)

audio = model.apply_tts(text=text, speaker=speaker, sample_rate=48000)
sf.write(out, audio.numpy(), 48000)
