#!/usr/bin/perl
# Builds the Croatian pages in hr/ from the English pages and i18n/hr-text.tsv.
#   perl i18n/build-hr.pl        (run from the site folder)
# The English pages stay the source: change them, add any new text to hr-text.tsv, run this again.
# It also makes sure each English page links to its Croatian copy (hreflang) and loads lang.js.
use strict;
use warnings;
use utf8;
use open qw(:std :encoding(UTF-8));

my @PAGES = qw(index.html about.html regular.html pro.html apply.html);
my %IS_PAGE = map { $_ => 1 } @PAGES;
my $SITE = 'https://brunozgela.com/';

# Text that stays the same in Croatian (names, brand, email).
my %KEEP = map { $_ => 1 } ('BRUNO ZGELA COACHING', 'Coaching PRO', 'Coaching REGULAR',
  'bruno.calicoach@gmail.com', 'PROGRAM');

# Alt texts, placeholders and labels inside tags.
my %ATTR = (
  'Bruno doing dips on parallel bars' => 'Bruno radi propadanja na razboju',
  'Bruno on the podium with a medal' => 'Bruno na postolju s medaljom',
  'Bruno showing torn palms from training' => 'Bruno pokazuje dlanove izranjene od treninga',
  'Bruno today' => 'Bruno danas',
  'Young Bruno training on outdoor street workout bars' => 'Mladi Bruno trenira na vanjskim street workout šipkama',
  'Close' => 'Zatvori',
  'Email address' => 'E-mail adresa',
  'Message' => 'Poruka',
  'Your name' => 'Tvoje ime',
  'Back to home page' => 'Natrag na početnu stranicu',
);

# Messages written by the pages' scripts (exact text inside the quotes).
my %SCRIPT = (
  'Sending...' => 'Šaljem...',
  "Thanks! Your message has been sent. I'll get back to you soon." => 'Hvala! Tvoja poruka je poslana. Javit ću ti se uskoro.',
  'Sorry, your message could not be sent. Please email me at bruno.calicoach@gmail.com.' => 'Nažalost, poruku nije bilo moguće poslati. Piši mi na bruno.calicoach@gmail.com.',
  'Send' => 'Pošalji',
  'Sorry, your application could not be sent. Your answers are still here, so please try again, or email me at bruno.calicoach@gmail.com.' => 'Nažalost, prijavu nije bilo moguće poslati. Tvoji odgovori su i dalje ovdje, pa pokušaj ponovno ili mi piši na bruno.calicoach@gmail.com.',
);

sub norm { my $s = shift; $s =~ s/\s+/ /g; $s =~ s/^ | $//g; return $s; }

# ---------- Read the reviewed Croatian text ----------
my %TEXT;
open(my $tsv, '<', 'i18n/hr-text.tsv') or die "Cannot read i18n/hr-text.tsv: $!";
while (my $line = <$tsv>) {
  $line =~ s/\r?\n$//;
  next if $line =~ /^#/ || $line !~ /\t/;
  my ($en, $hr) = split /\t/, $line, 2;
  $TEXT{norm($en)} = $hr;
}
close $tsv;

my %used;
my @missing;

sub translate_text {
  my ($text, $page) = @_;
  my $key = norm($text);
  return $text if $key eq '' || $key =~ /^[\d€+.,:·%\/\-–— ]*$/ || $key =~ /^\P{L}*$/;
  return $text if $KEEP{$key};
  if (exists $TEXT{$key}) {
    $used{$key} = 1;
    my ($lead) = $text =~ /^(\s*)/;
    my ($trail) = $text =~ /(\s*)$/;
    return $lead . $TEXT{$key} . $trail;
  }
  push @missing, "$page: $key";
  return $text;
}

sub fix_paths {
  # Pages in hr/ sit one folder deeper: point images, styles and scripts one level up.
  my $tag = shift;
  $tag =~ s{\b(src|href)="(?!https?:|mailto:|tel:|#|data:|\.\./)([^"]+)"}{
    my ($attr, $url) = ($1, $2);
    my ($file) = $url =~ m{^([^?#]+)};
    $IS_PAGE{$file // ''} ? qq{$attr="$url"} : qq{$attr="../$url"};
  }ge;
  $tag =~ s{url\((['"]?)(?!https?:|data:|\.\./)(folder/)}{url($1../$2}g;
  return $tag;
}

sub translate_tag {
  my $tag = shift;
  $tag =~ s{\b(alt|placeholder|aria-label|title)="([^"]*)"}{
    exists $ATTR{$2} ? qq{$1="$ATTR{$2}"} : qq{$1="$2"}
  }ge;
  return fix_paths($tag);
}

sub head_links {
  my ($page) = @_;
  my $path = $page eq 'index.html' ? '' : $page;
  return qq{<link rel="alternate" hreflang="en" href="$SITE$path">\n}
       . qq{<link rel="alternate" hreflang="hr" href="${SITE}hr/$path">\n}
       . qq{<link rel="alternate" hreflang="x-default" href="$SITE$path">\n};
}

mkdir 'hr' unless -d 'hr';

for my $page (@PAGES) {
  open(my $in, '<', $page) or die "Cannot read $page: $!";
  local $/; my $html = <$in>; close $in;
  $html =~ s/\r//g;

  # English page: language links in <head>, switch script before </body>.
  my $en = $html;
  $en =~ s{<link rel="alternate" hreflang="[^"]+" href="[^"]*">\n}{}g;
  $en =~ s{</head>}{head_links($page) . '</head>'}e;
  $en =~ s{<script src="lang\.js[^"]*"></script>\n}{}g;
  $en =~ s{</body>}{<script src="lang.js?v=1"></script>\n</body>};
  if ($en ne $html) {
    open(my $out, '>', $page) or die; print $out $en; close $out;
  }

  # Croatian copy.
  my $hr = '';
  for my $part (split /(<!--.*?-->|<script\b.*?<\/script>|<style\b.*?<\/style>|<[^>]+>)/s, $en) {
    next unless defined $part && length $part;
    if ($part =~ /^<!--/) { $hr .= $part; }
    elsif ($part =~ /^<script/) {
      my $script = $part;
      for my $en_text (keys %SCRIPT) {
        my $hr_text = $SCRIPT{$en_text};
        for my $q ("'", '"') {
          my $from = $q . $en_text . $q;
          my $to = $q eq "'" && $hr_text =~ /'/ ? '"' . $hr_text . '"' : $q . $hr_text . $q;
          $script =~ s/\Q$from\E/$to/g;
        }
      }
      $script =~ s{^(<script[^>]*>)}{fix_paths($1)}e;
      $hr .= $script;
    }
    elsif ($part =~ /^<style/) { $hr .= fix_paths($part); }
    elsif ($part =~ /^</) { $hr .= translate_tag($part); }
    else { $hr .= translate_text($part, $page); }
  }
  $hr =~ s{<html lang="en"}{<html lang="hr"};

  # The English level question isn't needed on the Croatian form. Its answer is still sent,
  # so every application email shows the same fields.
  if ($page eq 'apply.html') {
    $hr =~ s{<fieldset class="question">\s*<legend[^>]*>Ocijeni svoje znanje engleskog jezika</legend>.*?</fieldset>}
            {<input type="hidden" name="Rate your english level on a scale" value="I understand/speak Croatian (applied on the Croatian page)">}s
      or die "English level question not found in hr/apply.html";
  }
  $hr = "<!-- Generated by i18n/build-hr.pl from ../$page. Edit the English page and i18n/hr-text.tsv, then run it again. -->\n" . $hr
    unless $hr =~ /^<!-- Generated/;

  open(my $out, '>', "hr/$page") or die "Cannot write hr/$page: $!";
  print $out $hr;
  close $out;
  print "hr/$page written\n";
}

if (@missing) {
  print "\nText without a Croatian version (still English on the Croatian pages):\n";
  my %seen; print "  $_\n" for grep { !$seen{$_}++ } @missing;
} else {
  print "\nEvery piece of page text has a Croatian version.\n";
}
my @unused = grep { !$used{$_} } sort keys %TEXT;
if (@unused) {
  print "\nLines in hr-text.tsv not found on any page (English changed?):\n";
  print "  $_\n" for @unused;
}
