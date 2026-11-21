param([Parameter(Mandatory=$true)][string]$Storyboard, [Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $speaker.Rate = 0
    $format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(
        24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
        [System.Speech.AudioFormat.AudioChannel]::Mono)
    New-Item -ItemType Directory -Force -Path $Output | Out-Null
    foreach ($topic in (Get-Content -Raw -Encoding UTF8 -LiteralPath $Storyboard | ConvertFrom-Json)) {
        if ($topic.scenes) {
            for ($i = 0; $i -lt $topic.scenes.Count; $i++) {
                $lines = $topic.scenes[$i].lines
                for ($j = 0; $j -lt $lines.Count; $j++) {
                    $file = Join-Path $Output "$($topic.id)-$i-$j.wav"
                    $speaker.SetOutputToWaveFile($file, $format)
                    $speaker.Speak($lines[$j])
                    $speaker.SetOutputToNull()
                }
            }
            continue
        }
        for ($i = 0; $i -lt $topic.shots.Count; $i++) {
            $file = Join-Path $Output "$($topic.id)-$i.wav"
            $speaker.SetOutputToWaveFile($file, $format)
            $speaker.Speak($topic.shots[$i].voice)
            $speaker.SetOutputToNull()
        }
    }
} finally {
    $speaker.Dispose()
}
