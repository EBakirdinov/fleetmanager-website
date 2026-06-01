<?php

namespace App\Service;

use GuzzleHttp\Client;

use Psr\Container\ContainerInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

class ApiClient
{
    protected $container;

    protected $requestStack;
    
    protected $session;

    protected $client;

    public function __construct(ContainerInterface $container, RequestStack $requestStack, SessionInterface $session)
    {
        $this->container = $container;
        $this->requestStack = $requestStack;
        $this->session = $session;

        $this->client = new Client([
            'verify' => false,
            'base_uri' => $this->container->getParameter('api_url')
        ]);
    }

    public function request($path, $method = 'GET', $body = null, array $headers = null)
    {
        $options = array();

        $options['headers'] = ['Content-Type' => 'application/json'];

        if ($headers != null && is_array($headers)) {
            $options['headers'] = array_merge($options['headers'], $headers);
        }

        if (is_array($body) && count($body)) {
            $options['body'] = json_encode($body);
        }

        // $options['headers']['auto-auth'] = 'Bearer ' . $this->container->getParameter('auto_auth');

        try {
            $response = $this->client->request($method, $path, $options);
            $responseBody = $response->getBody();
        } catch( \Exception $e) {
            $responseBody = $e->getResponse()->getBody();
        }
        $responseArray = json_decode($responseBody, true);

        return $responseArray;
    }

    public function multipartRequest($path, $files, array $headers = null)
    {
        $options = array();

        $options['headers'] = array();

//        $options['headers']['auto-auth'] = 'Bearer ' . $this->container->getParameter('auto_auth');

        if ($headers != null && is_array($headers)) {
            $options['headers'] = array_merge($options['headers'], $headers);
        }

        $options['multipart'] = array(); 
        foreach ($files as $file) {
            $options['multipart'][] = array('name' => $file['name'], 'contents' => fopen($file['filename'], 'r'));
        }

        try {
            $response = $this->client->post($path, $options);
            $responseBody = $response->getBody();
        } catch( \Exception $e) {
            $responseBody = $e->getResponse()->getBody();
        }
        $responseArray = json_decode($responseBody, true);

        return $responseArray;
    }
}