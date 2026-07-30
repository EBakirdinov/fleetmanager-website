<?php

namespace App\Controller\Api;

use GuzzleHttp\Client;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;

class ProxyController extends AbstractController
{
    private $session;
    private $apiUrl;

    public function __construct(SessionInterface $session, string $apiUrl)
    {
        $this->session = $session;
        $this->apiUrl = rtrim($apiUrl, '/');
    }

    /**
     * @Route(
     *     "/api/proxy/{path}",
     *     name="api_proxy",
     *     requirements={"path"=".+"},
     *     methods={"GET","POST","PUT","PATCH","DELETE"}
     * )
     */
    public function proxy(Request $request, string $path): Response
    {
        $token = $this->session->get('stoken');
        if (!$token) {
            return new JsonResponse(['error' => 'Not authenticated.'], 401);
        }

        $client = new Client([
            'verify'      => false,
            'http_errors' => false,
            'base_uri'    => $this->apiUrl . '/',
        ]);

        $headers = [
            'Authorization' => 'Bearer ' . $token,
            'Accept'        => 'application/json',
        ];
        if ($request->headers->has('Content-Type')) {
            $headers['Content-Type'] = $request->headers->get('Content-Type');
        }

        $options = [
            'headers' => $headers,
            'query'   => $request->query->all(),
        ];

        // For multipart uploads, PHP has already consumed the body into
        // $_POST + $_FILES by the time we get here — `$request->getContent()`
        // is empty. Rebuild the multipart payload from the parsed request so
        // Guzzle can forward it upstream. Let Guzzle generate its own boundary
        // by dropping our client-supplied Content-Type.
        $isMultipart = strpos((string) $request->headers->get('Content-Type', ''), 'multipart/form-data') !== false;
        if ($isMultipart) {
            $multipart = [];
            foreach ($request->request->all() as $name => $value) {
                $multipart[] = ['name' => (string) $name, 'contents' => (string) $value];
            }
            foreach ($request->files->all() as $name => $file) {
                if ($file instanceof UploadedFile) {
                    // Read as bytes (not a stream) so Guzzle sends the full
                    // payload — passing an fopen() handle can arrive empty
                    // upstream depending on how PHP-FPM tears the request
                    // down.  Fine for the small doc images we're uploading.
                    $multipart[] = [
                        'name'     => (string) $name,
                        'contents' => file_get_contents($file->getRealPath()),
                        'filename' => $file->getClientOriginalName(),
                        'headers'  => ['Content-Type' => $file->getClientMimeType()],
                    ];
                }
            }
            $options['multipart'] = $multipart;
            unset($headers['Content-Type']);
            $options['headers'] = $headers;
        } else {
            $body = (string) $request->getContent();
            if ($body !== '') {
                $options['body'] = $body;
            }
        }

        $upstream = $client->request($request->getMethod(), $path, $options);

        $response = new Response(
            (string) $upstream->getBody(),
            $upstream->getStatusCode()
        );

        foreach (['Content-Type', 'Content-Language', 'Cache-Control'] as $header) {
            if ($upstream->hasHeader($header)) {
                $response->headers->set($header, $upstream->getHeaderLine($header));
            }
        }

        return $response;
    }
}
