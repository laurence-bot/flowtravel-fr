import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { AlertCircle, Calendar, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/demo/v/$token")({
  component: DemoPlayerPage,
  head: () => ({
    meta: [
      { title: "Démo FlowTravel — Confidentielle" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type DemoRequest = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  agence_nom: string;
  video_token: string;
  video_token_expires_at: string;
  video_view_count: number;
  video_max_views: number;
  video_first_viewed_at: string | null;
  locked_ip: string | null;
  statut: string;
};

function DemoPlayerPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState<DemoRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [obscured, setObscured] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const watchedSecondsRef = useRef<number>(0);

  // 1) Charger la demande, vérifier les verrous
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // IP visiteur
        let ip: string | null = null;
        try {
          const r = await fetch("https://api.ipify.org?format=json");
          if (r.ok) ip = (await r.json()).ip;
        } catch {
          /* noop */
        }

        const { data, error: dbError } = await supabase
          .from("demo_requests")
          .select(
            "id, prenom, nom, email, agence_nom, video_token, video_token_expires_at, video_view_count, video_max_views, video_first_viewed_at, locked_ip, statut"
          )
          .eq("video_token", token)
          .maybeSingle();

        if (cancelled) return;

        if (dbError || !data) {
          setError("Lien invalide ou inconnu.");
          await logView(null, ip, "lien_invalide");
          setLoading(false);
          return;
        }

        // Token expiré ?
        if (new Date(data.video_token_expires_at).getTime() < Date.now()) {
          setError("Votre lien d'accès a expiré (validité 48h).");
          await logView(data.id, ip, "expire");
          setLoading(false);
          return;
        }

        // Déjà visionné max fois ?
        if (data.video_view_count >= data.video_max_views) {
          setError(
            "Cette démo a déjà été visionnée. Pour un nouvel accès, contactez-nous ou réservez un RDV personnalisé."
          );
          await logView(data.id, ip, "visionnages_epuises");
          setLoading(false);
          return;
        }

        // IP différente du premier visionnage ?
        if (data.locked_ip && ip && data.locked_ip !== ip) {
          setError(
            "Ce lien a été ouvert depuis une autre adresse réseau. Pour des raisons de sécurité, il n'est plus accessible."
          );
          await logView(data.id, ip, "ip_differente");
          setLoading(false);
          return;
        }

        // OK : on peut jouer la vidéo
        setDemo(data as DemoRequest);

        // Récupération URL signée vidéo (10 min)
        const { data: signed, error: signErr } = await supabase.storage
          .from("demo-videos")
          .createSignedUrl("demo-flowtravel.mp4", 60 * 10);

        if (signErr || !signed?.signedUrl) {
          // Vidéo pas encore uploadée : on affiche un placeholder
          setVideoUrl(null);
        } else {
          setVideoUrl(signed.signedUrl);
        }

        // Incrémenter le compteur + locker l'IP au premier visionnage
        await supabase
          .from("demo_requests")
          .update({
            video_view_count: data.video_view_count + 1,
            video_first_viewed_at: data.video_first_viewed_at ?? new Date().toISOString(),
            locked_ip: data.locked_ip ?? ip,
            statut: data.statut === "en_attente" ? "visionne" : data.statut,
          })
          .eq("video_token", token);

        await logView(data.id, ip, null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError("Erreur de chargement de la démo.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function logView(
    demoRequestId: string | null,
    ip: string | null,
    blockedReason: string | null
  ) {
    if (!demoRequestId) return;
    try {
      await supabase.from("demo_video_views").insert({
        demo_request_id: demoRequestId,
        ip_address: ip,
        user_agent: navigator.userAgent.slice(0, 400),
        blocked_reason: blockedReason,
      });
    } catch {
      /* noop */
    }
  }

  // 2) Protections anti-capture
  useEffect(() => {
    if (!demo) return;

    const blockContext = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      // Bloquer Ctrl/Cmd+S, Ctrl/Cmd+P, Ctrl/Cmd+Shift+S, Print Screen, F12, Ctrl+Shift+I
      const k = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        ["s", "p", "u", "c", "a"].includes(k)
      ) {
        e.preventDefault();
        triggerObscure("raccourci");
      }
      if (k === "printscreen" || k === "f12") {
        e.preventDefault();
        triggerObscure("capture");
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) {
        e.preventDefault();
        triggerObscure("inspecteur");
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden && videoRef.current) {
        videoRef.current.pause();
      }
    };

    const onBlur = () => {
      if (videoRef.current) videoRef.current.pause();
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [demo]);

  function triggerObscure(reason: string) {
    setObscured(true);
    if (videoRef.current) videoRef.current.pause();
    toast.error(`Action bloquée (${reason}). Cette vidéo est confidentielle.`);
    setTimeout(() => setObscured(false), 3000);
  }

  // 3) Tracking durée visionnée
  useEffect(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const onTimeUpdate = () => {
      watchedSecondsRef.current = Math.floor(v.currentTime);
    };
    const onEnded = async () => {
      setVideoEnded(true);
      if (demo) {
        try {
          await supabase.from("demo_video_views").insert({
            demo_request_id: demo.id,
            duration_watched_seconds: watchedSecondsRef.current,
            completed: true,
            user_agent: navigator.userAgent.slice(0, 400),
          });
        } catch {
          /* noop */
        }
      }
    };
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [demo, videoUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Vérification de votre accès…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="font-display text-2xl text-foreground mb-2">Accès refusé</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link to="/demo">Faire une nouvelle demande</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!demo) return null;

  const watermark = `${demo.prenom} ${demo.nom} · ${demo.email} · ${demo.agence_nom}`;
  const startedAt = new Date(startTimeRef.current).toLocaleString("fr-FR");

  return (
    <div
      className="min-h-screen bg-[color:var(--primary)] text-primary-foreground select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <header className="border-b border-white/10">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Logo variant="light" />
          <div className="text-xs text-white/60">
            Session : {watermark} · {startedAt}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4">
          <AlertCircle className="h-5 w-5 text-[color:var(--gold)] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/90">
            <strong>Démo confidentielle.</strong> Cette vidéo vous est strictement personnelle et ne
            peut être visionnée qu'<strong>une seule fois</strong>. Tout enregistrement, capture ou
            diffusion est interdit et tracé (votre identité est incrustée dans la vidéo).
          </div>
        </div>

        {/* Player vidéo avec watermark superposé */}
        <div
          className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl"
          onContextMenu={(e) => e.preventDefault()}
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              controlsList="nodownload noplaybackrate noremoteplayback"
              disablePictureInPicture
              autoPlay
              className="w-full h-full"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-3">
              <div className="text-2xl font-display">Vidéo en préparation</div>
              <div className="text-sm max-w-md text-center">
                La vidéo de démonstration sera bientôt disponible. En attendant, vous pouvez
                réserver une démo personnalisée ci-dessous.
              </div>
            </div>
          )}

          {/* Watermark dynamique en mouvement */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute text-white/30 text-sm font-mono whitespace-nowrap drop-shadow-lg"
              style={{
                animation: "wm-drift 22s linear infinite",
                top: "20%",
              }}
            >
              {watermark}
            </div>
            <div
              className="absolute text-white/25 text-sm font-mono whitespace-nowrap drop-shadow-lg"
              style={{
                animation: "wm-drift 28s linear infinite reverse",
                top: "55%",
              }}
            >
              {watermark} · {new Date().toLocaleDateString("fr-FR")}
            </div>
            <div
              className="absolute text-white/20 text-xs font-mono whitespace-nowrap"
              style={{
                animation: "wm-drift 35s linear infinite",
                top: "80%",
              }}
            >
              CONFIDENTIEL · {watermark}
            </div>
          </div>

          {/* Overlay d'obscurcissement si tentative détectée */}
          {obscured && (
            <div className="absolute inset-0 bg-black/95 flex items-center justify-center text-center px-6">
              <div>
                <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
                <div className="text-xl font-display text-white">Action interdite détectée</div>
                <div className="text-sm text-white/70 mt-2">
                  Cette tentative a été enregistrée et associée à votre compte.
                </div>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes wm-drift {
            0% { transform: translateX(-30%); }
            100% { transform: translateX(130%); }
          }
        `}</style>

        {/* CTA après visionnage */}
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Card className="p-6 bg-white/5 border-white/10 text-white">
            <Calendar className="h-8 w-8 text-[color:var(--gold)] mb-3" />
            <h3 className="font-display text-xl mb-2">Démo personnalisée 30 min</h3>
            <p className="text-sm text-white/70 mb-4">
              Échangeons sur vos cas d'usage spécifiques et configurons votre compte ensemble.
            </p>
            <Button
              asChild
              className="w-full"
              variant={videoEnded ? "default" : "outline"}
            >
              <Link to="/demo/rdv/$token" params={{ token }}>
                Réserver un créneau
              </Link>
            </Button>
          </Card>

          <Card className="p-6 bg-white/5 border-white/10 text-white">
            <div className="h-8 w-8 rounded-full bg-[color:var(--gold)] text-[color:var(--primary)] flex items-center justify-center font-bold mb-3">
              €
            </div>
            <h3 className="font-display text-xl mb-2">Souscrire directement</h3>
            <p className="text-sm text-white/70 mb-4">
              Vous êtes convaincu ? Démarrez votre abonnement et accédez à FlowTravel
              immédiatement.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/tarifs">Voir les tarifs</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
